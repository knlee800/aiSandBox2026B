import { resolveRunResultGrant } from './run-result-grant';

describe('RESULT-TOOL-01 resolveRunResultGrant', () => {
  const signedRead = { harnessVersion: 'v1', runResultRead: true };

  it('grants the tool for harness v1, the read profile and runResultRead exactly true', () => {
    expect(resolveRunResultGrant(signedRead, 'read')).toBe(true);
  });

  it('never grants it for the review, write or agent-write profiles, or no profile', () => {
    for (const profile of ['review', 'write', 'agent-write', null]) {
      expect(resolveRunResultGrant(signedRead, profile)).toBe(false);
    }
  });

  it('never grants it for a missing or non-true field', () => {
    for (const runResultRead of [undefined, null, false, 'true', 1, 'yes', {}, [true]]) {
      expect(resolveRunResultGrant({ harnessVersion: 'v1', runResultRead }, 'read')).toBe(false);
    }
    expect(resolveRunResultGrant({ harnessVersion: 'v1' }, 'read')).toBe(false);
  });

  it('never grants it outside harness v1', () => {
    for (const harnessVersion of [undefined, null, 'v2', 'V1', 1]) {
      expect(resolveRunResultGrant({ harnessVersion, runResultRead: true }, 'read')).toBe(false);
    }
  });
});
