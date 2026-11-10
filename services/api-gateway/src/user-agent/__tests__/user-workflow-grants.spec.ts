import {
  CALENDAR_TOOL_ID,
  MAIL_TOOL_ID,
} from '../../connectors/connector-servers';
import { KNOWLEDGE_SCOPES } from '../../knowledge/knowledge-scopes';
import {
  USER_WORKFLOW_TOOL_PROFILES,
  allowlistedConnectorToolIds,
  userWorkflowGrants,
} from '../user-workflow-grants';

describe('userWorkflowGrants (BIZ-USER-01A D7)', () => {
  const catalogue = KNOWLEDGE_SCOPES.map((scope) => scope.id);

  it('allows only the read tool profile', () => {
    expect([...USER_WORKFLOW_TOOL_PROFILES]).toEqual(['read']);
  });

  it('empty input yields empty grants and nothing dropped', () => {
    const grants = userWorkflowGrants(
      { toolProfile: 'read', knowledgeScopeIds: [], connectorToolIds: [] },
      ['imap', 'ical'],
    );
    expect(grants).toEqual({
      toolProfile: 'read',
      knowledgeScopeIds: [],
      connectorToolIds: [],
      dropped: {
        toolProfile: null,
        knowledgeScopeIds: [],
        connectorToolIds: [],
        missingConnections: [],
      },
    });
  });

  it.each(['write', 'review', 'admin', null, undefined, 7])(
    'replaces tool profile %p with read and reports it',
    (profile) => {
      const grants = userWorkflowGrants(
        { toolProfile: profile, knowledgeScopeIds: [], connectorToolIds: [] },
        [],
      );
      expect(grants.toolProfile).toBe('read');
      expect(grants.dropped.toolProfile).toBe(String(profile));
    },
  );

  it('drops unknown and duplicate scope ids and keeps catalogue order', () => {
    const grants = userWorkflowGrants(
      {
        toolProfile: 'read',
        knowledgeScopeIds: ['policies', 'hr-payroll', 'company-monthly-reports', 'policies', 42],
        connectorToolIds: [],
      },
      [],
    );
    expect(grants.knowledgeScopeIds).toEqual(['company-monthly-reports', 'policies']);
    expect(grants.dropped.knowledgeScopeIds).toEqual(['hr-payroll', '42']);
  });

  it('keeps at most the nine catalogue scopes', () => {
    const grants = userWorkflowGrants(
      {
        toolProfile: 'read',
        knowledgeScopeIds: [...catalogue].reverse().concat(catalogue),
        connectorToolIds: [],
      },
      [],
    );
    expect(grants.knowledgeScopeIds).toEqual(catalogue);
    expect(grants.knowledgeScopeIds).toHaveLength(9);
  });

  it('grants a connector tool only when its kind is connected', () => {
    const grants = userWorkflowGrants(
      {
        toolProfile: 'read',
        knowledgeScopeIds: [],
        connectorToolIds: [MAIL_TOOL_ID, CALENDAR_TOOL_ID, MAIL_TOOL_ID],
      },
      ['ical'],
    );
    expect(grants.connectorToolIds).toEqual([CALENDAR_TOOL_ID]);
    expect(grants.dropped.missingConnections).toEqual([{ toolId: MAIL_TOOL_ID, kind: 'imap' }]);
    expect(grants.dropped.connectorToolIds).toEqual([]);
  });

  it('drops tool ids outside the allowlist', () => {
    const grants = userWorkflowGrants(
      {
        toolProfile: 'read',
        knowledgeScopeIds: [],
        connectorToolIds: ['mail_send', MAIL_TOOL_ID, 'mail_send'],
      },
      ['imap', 'ical', 'mail_send'],
    );
    expect(grants.connectorToolIds).toEqual([MAIL_TOOL_ID]);
    expect(grants.dropped.connectorToolIds).toEqual(['mail_send']);
  });

  it('treats a non-array access value as empty', () => {
    const grants = userWorkflowGrants(
      { toolProfile: 'read', knowledgeScopeIds: 'policies', connectorToolIds: { 0: MAIL_TOOL_ID } },
      ['imap'],
    );
    expect(grants.knowledgeScopeIds).toEqual([]);
    expect(grants.connectorToolIds).toEqual([]);
  });

  it('never returns an id the input did not contain', () => {
    const inputs: string[][] = [
      [],
      ['policies'],
      ['strategy-docs', 'market-data', 'nope'],
      catalogue,
    ];
    const toolInputs: string[][] = [[], [MAIL_TOOL_ID], [CALENDAR_TOOL_ID, 'x'], [MAIL_TOOL_ID, CALENDAR_TOOL_ID]];
    for (const scopes of inputs) {
      for (const tools of toolInputs) {
        for (const kinds of [[], ['imap'], ['ical'], ['imap', 'ical']]) {
          const grants = userWorkflowGrants(
            { toolProfile: 'write', knowledgeScopeIds: scopes, connectorToolIds: tools },
            kinds,
          );
          for (const id of grants.knowledgeScopeIds) {
            expect(scopes).toContain(id);
            expect(catalogue).toContain(id);
          }
          for (const id of grants.connectorToolIds) {
            expect(tools).toContain(id);
          }
          expect(grants.toolProfile).toBe('read');
        }
      }
    }
  });

  it('allowlistedConnectorToolIds keeps known ids once, in input order', () => {
    expect(
      allowlistedConnectorToolIds([CALENDAR_TOOL_ID, 'x', MAIL_TOOL_ID, CALENDAR_TOOL_ID]),
    ).toEqual([CALENDAR_TOOL_ID, MAIL_TOOL_ID]);
    expect(allowlistedConnectorToolIds(undefined)).toEqual([]);
  });
});
