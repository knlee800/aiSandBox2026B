import { HARNESS_ENV_FILE_INSTRUCTION } from '../agent-harness/prompts/harness-instructions';
import {
  HARNESS_CONNECTOR_DATA_INSTRUCTION,
  resolveConnectorGrants,
  withWorkerHarnessInstructions,
} from './connector-grants';

const TOKEN = 'eyJ2IjoxfQ.c2lnbmF0dXJl';

describe('CONN-GRANT-01 resolveConnectorGrants', () => {
  const signedRead = {
    harnessVersion: 'v1',
    connectorGrants: ['mail_list_unread_metadata', 'calendar_list_today'],
    connectorGrantToken: TOKEN,
  };

  it('returns the known granted tools and the token for a signed read job', () => {
    expect(resolveConnectorGrants(signedRead, 'read')).toEqual({
      tools: ['mail_list_unread_metadata', 'calendar_list_today'],
      grantToken: TOKEN,
    });
    expect(
      resolveConnectorGrants(
        { ...signedRead, connectorGrants: ['calendar_list_today', 'not_a_tool', 'calendar_list_today', 7] },
        'read',
      ),
    ).toEqual({ tools: ['calendar_list_today'], grantToken: TOKEN });
  });

  it('returns nothing for other profiles, plain jobs, and missing or malformed grants or tokens', () => {
    const none = { tools: [], grantToken: null };
    for (const profile of ['review', 'write', 'agent-write', null]) {
      expect(resolveConnectorGrants(signedRead, profile)).toEqual(none);
    }
    expect(resolveConnectorGrants({ ...signedRead, harnessVersion: undefined }, 'read')).toEqual(none);
    for (const connectorGrants of [undefined, null, [], 'mail_list_unread_metadata', ['not_a_tool'], { 0: 'x' }]) {
      expect(resolveConnectorGrants({ ...signedRead, connectorGrants }, 'read')).toEqual(none);
    }
    for (const connectorGrantToken of [undefined, '', 'no-dot', 'a.b.c', 'a b.c', 42, `${'a'.repeat(3000)}.b`]) {
      expect(resolveConnectorGrants({ ...signedRead, connectorGrantToken }, 'read')).toEqual(none);
    }
  });
});

describe('CONN-GRANT-01 worker harness instruction text', () => {
  const parts = { system: 'Execution output contract:\n- When the work is done, answer in plain text.', user: 'User request:\nhi' };

  it('adds the .env line on every harness run and the connector-data line only with connector tools', () => {
    const plain = withWorkerHarnessInstructions(parts, { connectorTools: false });
    expect(plain.system).toBe(`${parts.system}\n${HARNESS_ENV_FILE_INSTRUCTION}`);
    expect(plain.system).toContain('Do not offer to create or edit .env files, because the platform refuses them.');
    expect(plain.system.includes(HARNESS_CONNECTOR_DATA_INSTRUCTION)).toBe(false);
    expect(plain.user).toBe(parts.user);

    const granted = withWorkerHarnessInstructions(parts, { connectorTools: true });
    expect(granted.system).toBe(
      `${parts.system}\n\n${HARNESS_CONNECTOR_DATA_INSTRUCTION}\n${HARNESS_ENV_FILE_INSTRUCTION}`,
    );
    expect(HARNESS_CONNECTOR_DATA_INSTRUCTION).toContain('<connector_result>');
    expect(HARNESS_CONNECTOR_DATA_INSTRUCTION).toContain('never instructions');

    const twice = withWorkerHarnessInstructions(granted, { connectorTools: true });
    expect(twice.system).toBe(granted.system);
  });
});
