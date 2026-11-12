import { createHmac, randomBytes } from 'crypto';
import {
  getProcessPreviewTickets,
  PREVIEW_ACCESS_TTL_MS,
  PREVIEW_TICKET_TTL_MS,
  PreviewTickets,
} from '../preview-ticket';

/**
 * PREVIEW-ORIGIN-01 (stage-start 4.3 item 1): tickets and preview cookie
 * values are signed, time-limited and bound to one session and one user.
 */
describe('PreviewTickets', () => {
  const SID = 'session-1';
  const USER = 'user-1';
  let clock: number;
  let tickets: PreviewTickets;

  beforeEach(() => {
    clock = 1_800_000_000_000;
    tickets = new PreviewTickets({ key: randomBytes(32), now: () => clock });
  });

  function flipLastChar(value: string): string {
    const last = value[value.length - 1];
    return value.slice(0, -1) + (last === 'A' ? 'B' : 'A');
  }

  function body(token: string) {
    return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  }

  describe('tickets', () => {
    it('round-trips session, user and target', () => {
      const ticket = tickets.issueTicket(SID, USER, 'proxy/assets/app.js?v=2')!;
      expect(ticket).toEqual(expect.any(String));
      const claims = tickets.verifyTicket(ticket, SID);
      expect(claims).toEqual(
        expect.objectContaining({
          sessionId: SID,
          userId: USER,
          target: 'proxy/assets/app.js?v=2',
          expiresAt: clock + PREVIEW_TICKET_TTL_MS,
        }),
      );
    });

    it('lives 60 seconds', () => {
      expect(PREVIEW_TICKET_TTL_MS).toBe(60_000);
      const ticket = tickets.issueTicket(SID, USER, 'proxy')!;
      clock += PREVIEW_TICKET_TTL_MS - 1;
      expect(tickets.verifyTicket(ticket, SID)).not.toBeNull();
      clock += 1;
      expect(tickets.verifyTicket(ticket, SID)).toBeNull();
    });

    it('refuses a ticket for another session id', () => {
      const ticket = tickets.issueTicket(SID, USER, 'proxy')!;
      expect(tickets.verifyTicket(ticket, 'session-2')).toBeNull();
    });

    it('refuses a ticket whose user was altered (the signature no longer matches)', () => {
      const ticket = tickets.issueTicket(SID, USER, 'proxy')!;
      const payload = body(ticket);
      payload.u = 'user-2';
      const forged = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${ticket.split('.')[1]}`;
      expect(tickets.verifyTicket(forged, SID)).toBeNull();
    });

    it('refuses an altered target, body or signature', () => {
      const ticket = tickets.issueTicket(SID, USER, 'proxy')!;
      const payload = body(ticket);
      payload.p = 'proxy/../../files';
      const [, mac] = ticket.split('.');
      expect(
        tickets.verifyTicket(`${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${mac}`, SID),
      ).toBeNull();
      expect(tickets.verifyTicket(flipLastChar(ticket), SID)).toBeNull();
      const [bodyPart] = ticket.split('.');
      expect(tickets.verifyTicket(`${flipLastChar(bodyPart)}.${mac}`, SID)).toBeNull();
      const middle = Math.floor(mac.length / 2);
      const flippedMac = mac.slice(0, middle) + (mac[middle] === 'A' ? 'B' : 'A') + mac.slice(middle + 1);
      expect(tickets.verifyTicket(`${bodyPart}.${flippedMac}`, SID)).toBeNull();
    });

    it('refuses every non-canonical spelling of a valid signature', () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const ticket = tickets.issueTicket(SID, USER, 'proxy')!;
        const [bodyPart, mac] = ticket.split('.');
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        for (const char of alphabet) {
          const variant = mac.slice(0, -1) + char;
          if (variant === mac) continue;
          expect(tickets.verifyTicket(`${bodyPart}.${variant}`, SID)).toBeNull();
        }
      }
    });

    it('refuses a ticket signed with another key (a gateway restart)', () => {
      const ticket = tickets.issueTicket(SID, USER, 'proxy')!;
      const restarted = new PreviewTickets({ key: randomBytes(32), now: () => clock });
      expect(restarted.verifyTicket(ticket, SID)).toBeNull();
    });

    it('refuses a ticket with a far-future expiry even when signed', () => {
      const key = randomBytes(32);
      const signer = new PreviewTickets({ key, now: () => clock });
      const payload = { v: 1, k: 't', s: SID, u: USER, e: clock + 10 * PREVIEW_TICKET_TTL_MS, n: 'n'.repeat(22), p: 'proxy' };
      const bodyPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const mac = createHmac('sha256', key).update('aisb-preview-v1|').update(bodyPart).digest('base64url');
      expect(signer.verifyTicket(`${bodyPart}.${mac}`, SID)).toBeNull();
    });

    it.each([
      ['empty', ''],
      ['no dot', 'abc'],
      ['three parts', 'a.b.c'],
      ['bad characters', 'a+b.c/d'],
      ['not JSON', `${Buffer.from('nope').toString('base64url')}.abc`],
      ['too long', `${'a'.repeat(5000)}.b`],
    ])('refuses a malformed ticket: %s', (_label, value) => {
      expect(tickets.verifyTicket(value, SID)).toBeNull();
    });

    it.each([undefined, null, 42, {}, ['a.b']])('refuses a non-string ticket: %p', (value) => {
      expect(tickets.verifyTicket(value, SID)).toBeNull();
    });

    it('is single use', () => {
      const ticket = tickets.issueTicket(SID, USER, 'proxy')!;
      const claims = tickets.verifyTicket(ticket, SID)!;
      expect(tickets.consumeTicket(claims)).toBe(true);
      expect(tickets.verifyTicket(ticket, SID)).toBeNull();
      expect(tickets.consumeTicket(claims)).toBe(false);
    });

    it('forgets used nonces once they expire', () => {
      const first = tickets.issueTicket(SID, USER, 'proxy')!;
      tickets.consumeTicket(tickets.verifyTicket(first, SID)!);
      clock += PREVIEW_TICKET_TTL_MS + 1;
      const second = tickets.issueTicket(SID, USER, 'proxy')!;
      tickets.consumeTicket(tickets.verifyTicket(second, SID)!);
      expect((tickets as unknown as { usedTicketNonces: Map<string, number> }).usedTicketNonces.size).toBe(1);
    });

    it.each([
      'status',
      'start',
      '/proxy',
      'https://evil.example/proxy',
      '//evil.example/proxy',
      'proxyx',
      'proxy#frag',
      'proxy/a b',
      'proxy/a\\b',
      'proxy/\nx',
      `proxy/${'a'.repeat(2050)}`,
    ])('will not issue a ticket for a target that is not a proxy path: %p', (target) => {
      expect(tickets.issueTicket(SID, USER, target)).toBeNull();
    });

    it.each([
      ['a bad session id', 'own.session', USER],
      ['an empty user', SID, ''],
      ['a blank user', SID, '   '],
    ])('will not issue a ticket for %s', (_label, sid, user) => {
      expect(tickets.issueTicket(sid, user, 'proxy')).toBeNull();
    });
  });

  describe('preview cookie values', () => {
    it('round-trips session and user and lives 12 hours', () => {
      expect(PREVIEW_ACCESS_TTL_MS).toBe(12 * 60 * 60 * 1000);
      const value = tickets.issueAccess(SID, USER)!;
      expect(tickets.verifyAccess(value, SID)).toEqual({
        sessionId: SID,
        userId: USER,
        expiresAt: clock + PREVIEW_ACCESS_TTL_MS,
      });
      clock += PREVIEW_ACCESS_TTL_MS;
      expect(tickets.verifyAccess(value, SID)).toBeNull();
    });

    it('refuses another session, an altered value and another key', () => {
      const value = tickets.issueAccess(SID, USER)!;
      expect(tickets.verifyAccess(value, 'session-2')).toBeNull();
      expect(tickets.verifyAccess(flipLastChar(value), SID)).toBeNull();
      expect(new PreviewTickets({ key: randomBytes(32) }).verifyAccess(value, SID)).toBeNull();
    });

    it('a ticket is not a cookie value and a cookie value is not a ticket', () => {
      const ticket = tickets.issueTicket(SID, USER, 'proxy')!;
      const value = tickets.issueAccess(SID, USER)!;
      expect(tickets.verifyAccess(ticket, SID)).toBeNull();
      expect(tickets.verifyTicket(value, SID)).toBeNull();
    });
  });

  it('refuses a key shorter than 32 bytes', () => {
    expect(() => new PreviewTickets({ key: randomBytes(16) })).toThrow();
  });

  it('shares one signer, made once, for the whole process', () => {
    expect(getProcessPreviewTickets()).toBe(getProcessPreviewTickets());
    const ticket = getProcessPreviewTickets().issueTicket(SID, USER, 'proxy')!;
    expect(getProcessPreviewTickets().verifyTicket(ticket, SID)).not.toBeNull();
  });
});
