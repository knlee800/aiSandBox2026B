import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { DailyCreditCapService } from './daily-credit-cap.service';

type LedgerRow = {
  ownerId: string;
  requestedCredits: number;
  createdAt: Date;
};

type BuiltQuery = {
  select?: string;
  where?: string;
  since?: Date;
  andWhere?: string;
  userId?: string;
};

function createLedger(rows: LedgerRow[], options?: { fail?: boolean }) {
  const queries: BuiltQuery[] = [];
  const repo = {
    createQueryBuilder: jest.fn(() => {
      const built: BuiltQuery = {};
      queries.push(built);
      const qb = {
        select: (selection: string) => {
          built.select = selection;
          return qb;
        },
        where: (clause: string, params: { since: Date }) => {
          built.where = clause;
          built.since = params.since;
          return qb;
        },
        andWhere: (clause: string, params: { userId: string }) => {
          built.andWhere = clause;
          built.userId = params.userId;
          return qb;
        },
        getRawOne: async () => {
          if (options?.fail) {
            throw new Error('db down: secret payload');
          }
          const total = rows
            .filter(
              (row) =>
                built.since !== undefined && row.createdAt >= built.since,
            )
            .filter(
              (row) => built.userId === undefined || row.ownerId === built.userId,
            )
            .reduce((sum, row) => sum + row.requestedCredits, 0);
          return { total: String(total) };
        },
      };
      return qb;
    }),
  };
  return { repo, queries };
}

async function refusal(action: Promise<unknown>): Promise<HttpException> {
  try {
    await action;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    return error as HttpException;
  }
  throw new Error('expected a refusal');
}

describe('DailyCreditCapService', () => {
  const originalPlatform = process.env.MAX_DAILY_CREDITS_PLATFORM;
  const originalUser = process.env.MAX_DAILY_CREDITS_PER_USER;

  beforeEach(() => {
    delete process.env.MAX_DAILY_CREDITS_PLATFORM;
    delete process.env.MAX_DAILY_CREDITS_PER_USER;
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalPlatform === undefined) {
      delete process.env.MAX_DAILY_CREDITS_PLATFORM;
    } else {
      process.env.MAX_DAILY_CREDITS_PLATFORM = originalPlatform;
    }
    if (originalUser === undefined) {
      delete process.env.MAX_DAILY_CREDITS_PER_USER;
    } else {
      process.env.MAX_DAILY_CREDITS_PER_USER = originalUser;
    }
  });

  function serviceFor(rows: LedgerRow[], options?: { fail?: boolean }) {
    const ledger = createLedger(rows, options);
    return {
      ledger,
      service: new DailyCreditCapService(ledger.repo as never),
    };
  }

  function todayRow(
    ownerId: string,
    requestedCredits: number,
  ): LedgerRow {
    return { ownerId, requestedCredits, createdAt: new Date() };
  }

  it('allows a run when both totals are under the caps', async () => {
    const { service, ledger } = serviceFor([
      todayRow('user-01', 499),
      todayRow('user-02', 500),
    ]);

    await expect(service.assertWithinDailyCap('user-01')).resolves.toBeUndefined();

    expect(ledger.repo.createQueryBuilder).toHaveBeenCalledWith('record');
    expect(ledger.queries).toHaveLength(2);
    expect(ledger.queries[0].select).toBe(
      'COALESCE(SUM(record.requestedCredits), 0)',
    );
    expect(ledger.queries[0].where).toBe('record.createdAt >= :since');
    expect(ledger.queries[0].andWhere).toBeUndefined();
    expect(ledger.queries[1].andWhere).toBe('record.ownerId = :userId');
    expect(ledger.queries[1].userId).toBe('user-01');
    expect(JSON.stringify(ledger.queries)).not.toContain('status');
  });

  it('refuses when the platform total has reached the cap', async () => {
    const { service } = serviceFor([
      todayRow('user-01', 100),
      todayRow('user-02', 900),
    ]);

    const error = await refusal(service.assertWithinDailyCap('user-01'));
    expect(error.getStatus()).toBe(429);
    expect(error.message).toBe('Daily credit limit reached');
    expect(error.getResponse()).toMatchObject({ cap: 'platform' });
  });

  it('refuses when the user total has reached the cap', async () => {
    const { service } = serviceFor([todayRow('user-01', 500)]);

    const error = await refusal(service.assertWithinDailyCap('user-01'));
    expect(error.getStatus()).toBe(429);
    expect(error.message).toBe('Daily credit limit reached');
    expect(error.getResponse()).toMatchObject({ cap: 'user' });
  });

  it('does not count rows created before 00:00 UTC', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-05T18:00:00.000Z'));
    const beforeMidnight = new Date('2026-11-04T23:59:59.999Z');
    const atMidnight = new Date('2026-11-05T00:00:00.000Z');

    const earlier = serviceFor([
      {
        ownerId: 'user-01',
        requestedCredits: 500,
        createdAt: beforeMidnight,
      },
    ]);
    await expect(
      earlier.service.assertWithinDailyCap('user-01'),
    ).resolves.toBeUndefined();
    expect(earlier.ledger.queries[0].since?.toISOString()).toBe(
      '2026-11-05T00:00:00.000Z',
    );

    const onTheDay = serviceFor([
      { ownerId: 'user-01', requestedCredits: 500, createdAt: atMidnight },
    ]);
    const error = await refusal(onTheDay.service.assertWithinDailyCap('user-01'));
    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({ cap: 'user' });
  });

  it('falls back to the defaults when the env value is missing, empty, non-numeric, or non-positive', async () => {
    const invalid = ['', '   ', 'abc', '0', '-5', 'NaN'];
    for (const value of invalid) {
      process.env.MAX_DAILY_CREDITS_PER_USER = value;
      process.env.MAX_DAILY_CREDITS_PLATFORM = value;

      const underUser = serviceFor([todayRow('user-01', 499)]);
      await expect(
        underUser.service.assertWithinDailyCap('user-01'),
      ).resolves.toBeUndefined();

      const atUser = serviceFor([todayRow('user-01', 500)]);
      const userError = await refusal(
        atUser.service.assertWithinDailyCap('user-01'),
      );
      expect(userError.getResponse()).toMatchObject({ cap: 'user' });

      const underPlatform = serviceFor([
        todayRow('user-01', 100),
        todayRow('user-02', 899),
      ]);
      await expect(
        underPlatform.service.assertWithinDailyCap('user-01'),
      ).resolves.toBeUndefined();

      const atPlatform = serviceFor([
        todayRow('user-01', 100),
        todayRow('user-02', 900),
      ]);
      const platformError = await refusal(
        atPlatform.service.assertWithinDailyCap('user-01'),
      );
      expect(platformError.getResponse()).toMatchObject({ cap: 'platform' });
    }

    delete process.env.MAX_DAILY_CREDITS_PER_USER;
    delete process.env.MAX_DAILY_CREDITS_PLATFORM;
    const missing = serviceFor([todayRow('user-01', 499)]);
    await expect(missing.service.assertWithinDailyCap('user-01')).resolves.toBeUndefined();
  });

  it('uses a positive numeric env cap', async () => {
    process.env.MAX_DAILY_CREDITS_PER_USER = '10';
    process.env.MAX_DAILY_CREDITS_PLATFORM = '20';

    const under = serviceFor([todayRow('user-01', 9)]);
    await expect(under.service.assertWithinDailyCap('user-01')).resolves.toBeUndefined();

    const atUser = serviceFor([todayRow('user-01', 10)]);
    expect(
      (await refusal(atUser.service.assertWithinDailyCap('user-01'))).getResponse(),
    ).toMatchObject({ cap: 'user' });

    const atPlatform = serviceFor([
      todayRow('user-01', 9),
      todayRow('user-02', 11),
    ]);
    expect(
      (
        await refusal(atPlatform.service.assertWithinDailyCap('user-01'))
      ).getResponse(),
    ).toMatchObject({ cap: 'platform' });
  });

  it('refuses when the repository fails and does not log the error payload', async () => {
    const { service } = serviceFor([], { fail: true });
    const warn = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);

    const error = await refusal(service.assertWithinDailyCap('user-01'));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getStatus()).toBe(503);
    expect(error.message).toBe('Daily credit limit check failed');
    expect(error.message).not.toContain('secret payload');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toEqual(['Daily credit cap check failed']);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret payload');
  });

  it.each([undefined, null, '', '   '])(
    'refuses a missing user id (%p) without reading the ledger',
    async (userId) => {
      const { service, ledger } = serviceFor([todayRow('user-01', 1)]);
      const error = await refusal(service.assertWithinDailyCap(userId));
      expect(error.getStatus()).toBe(429);
      expect(error.message).toBe('Daily credit limit reached');
      expect(error.getResponse()).not.toMatchObject({ cap: 'user' });
      expect(ledger.repo.createQueryBuilder).not.toHaveBeenCalled();
    },
  );
});
