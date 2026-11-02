import { ExecutionResultService } from '../execution-result.service';

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function assertNoSensitiveColumns(sql: string): void {
  const stripped = sql
    .replace(/metadata->>'runMode'/g, '')
    .replace(/metadata->>'agentId'/g, '');
  expect(stripped.toLowerCase()).not.toContain('metadata');
  expect(stripped.toLowerCase()).not.toContain('prompt');
  expect(stripped.toLowerCase()).not.toContain('output');
}

const SELECT_LIST = [
  'execution_id',
  'session_id',
  'execution_status',
  'provider',
  'model',
  'tokens_used',
  'execution_duration_ms',
  '"timestamp"',
  `metadata->>'runMode' AS "runMode"`,
  `metadata->>'agentId' AS "agentId"`,
].join(', ');

const ACTIVE_STATUS =
  "execution_status IN ('pending', 'running', 'cancel_requested')";

describe('ExecutionResultService.listRunsForUser', () => {
  const userId = "user-1'); DROP TABLE usage_records;--";
  const sessionId = '35d53116-6723-4571-af12-ac256977c007';

  function createService(rows: unknown[] = [{ execution_id: 'exec-1' }]) {
    const query = jest.fn().mockResolvedValue(rows);
    const service = new ExecutionResultService({ query } as never);
    return { service, query };
  }

  function readCall(query: jest.Mock): { sql: string; params: unknown[] } {
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(typeof sql).toBe('string');
    expect(Array.isArray(params)).toBe(true);
    return { sql, params };
  }

  function expectOwnerBound(sql: string, params: unknown[]): void {
    expect(sql).toContain('user_id = $1');
    expect(params[0]).toBe(userId);
    expect(sql).not.toContain(userId);
    expect(sql).not.toContain('DROP TABLE');
    assertNoSensitiveColumns(sql);
    expect(normalizeSql(sql)).toContain(`SELECT ${SELECT_LIST} FROM usage_records`);
    expect(normalizeSql(sql)).toContain('ORDER BY "timestamp" DESC');
  }

  it('queries active runs for the user without a session filter', async () => {
    const { service, query } = createService();

    await expect(
      service.listRunsForUser({ userId, state: 'active', limit: 7 }),
    ).resolves.toEqual([{ execution_id: 'exec-1' }]);

    const { sql, params } = readCall(query);
    expectOwnerBound(sql, params);
    expect(normalizeSql(sql)).toBe(
      `SELECT ${SELECT_LIST} FROM usage_records WHERE user_id = $1 AND ${ACTIVE_STATUS} ORDER BY "timestamp" DESC LIMIT $2`,
    );
    expect(normalizeSql(sql)).not.toContain('session_id =');
    expect(params).toEqual([userId, 7]);
    expect(sql).not.toContain('7');
  });

  it('queries active runs for the user and binds sessionId', async () => {
    const { service, query } = createService();

    await service.listRunsForUser({
      userId,
      state: 'active',
      sessionId,
      limit: 11,
    });

    const { sql, params } = readCall(query);
    expectOwnerBound(sql, params);
    expect(normalizeSql(sql)).toBe(
      `SELECT ${SELECT_LIST} FROM usage_records WHERE user_id = $1 AND session_id = $2 AND ${ACTIVE_STATUS} ORDER BY "timestamp" DESC LIMIT $3`,
    );
    expect(sql).not.toContain(sessionId);
    expect(params).toEqual([userId, sessionId, 11]);
  });

  it('queries recent runs for the user with no status filter', async () => {
    const { service, query } = createService();

    await service.listRunsForUser({ userId, state: 'recent', limit: 20 });

    const { sql, params } = readCall(query);
    expectOwnerBound(sql, params);
    expect(normalizeSql(sql)).toBe(
      `SELECT ${SELECT_LIST} FROM usage_records WHERE user_id = $1 ORDER BY "timestamp" DESC LIMIT $2`,
    );
    expect(sql).not.toContain('execution_status IN');
    expect(normalizeSql(sql)).not.toContain('session_id =');
    expect(params).toEqual([userId, 20]);
  });

  it('queries recent runs for the user and binds sessionId', async () => {
    const { service, query } = createService();

    await service.listRunsForUser({
      userId,
      state: 'recent',
      sessionId,
      limit: 3,
    });

    const { sql, params } = readCall(query);
    expectOwnerBound(sql, params);
    expect(normalizeSql(sql)).toBe(
      `SELECT ${SELECT_LIST} FROM usage_records WHERE user_id = $1 AND session_id = $2 ORDER BY "timestamp" DESC LIMIT $3`,
    );
    expect(sql).not.toContain('execution_status IN');
    expect(sql).not.toContain(sessionId);
    expect(params).toEqual([userId, sessionId, 3]);
  });
});
