import { CALENDAR_TOOL_ID, MAIL_TOOL_ID } from '../connectors/connector-servers';
import { SYSTEM_AGENT_DEFINITIONS } from '../system-agents/system-agent-registry';
import {
  COLLABORATION_ROLE_CONNECTOR_TOOLS,
  collaborationRoleConnectorToolIds,
} from './collaboration-tool-profile';

describe('AGENT-SPEC-01 role connector tools come from the system agent registry', () => {
  it('lists each agent with connector tools, by its registry connectorToolIds', () => {
    const expected: Record<string, readonly string[]> = {};
    for (const agent of SYSTEM_AGENT_DEFINITIONS) {
      if (agent.connectorToolIds.length > 0) {
        expected[agent.id] = agent.connectorToolIds;
      }
    }
    expect(COLLABORATION_ROLE_CONNECTOR_TOOLS).toEqual(expected);
    expect(COLLABORATION_ROLE_CONNECTOR_TOOLS).toEqual({
      'chief-of-staff': [MAIL_TOOL_ID, CALENDAR_TOOL_ID],
    });
    for (const agent of SYSTEM_AGENT_DEFINITIONS) {
      expect(collaborationRoleConnectorToolIds(agent.id)).toEqual([...agent.connectorToolIds]);
    }
  });

  it('keeps the record and its lists frozen and apart from the registry arrays', () => {
    expect(Object.isFrozen(COLLABORATION_ROLE_CONNECTOR_TOOLS)).toBe(true);
    const chief = SYSTEM_AGENT_DEFINITIONS.find((agent) => agent.id === 'chief-of-staff');
    expect(Object.isFrozen(COLLABORATION_ROLE_CONNECTOR_TOOLS['chief-of-staff'])).toBe(true);
    expect(COLLABORATION_ROLE_CONNECTOR_TOOLS['chief-of-staff']).not.toBe(chief?.connectorToolIds);
  });
});
