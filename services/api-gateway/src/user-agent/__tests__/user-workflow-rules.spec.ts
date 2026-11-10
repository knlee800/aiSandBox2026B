import {
  SYSTEM_AGENT_DEFINITIONS,
  systemAgentById,
} from '../../system-agents/system-agent-registry';
import {
  USER_WORKFLOW_RULES,
  USER_WORKFLOW_TEMPLATE_IDS,
  isUserWorkflowTemplateId,
} from '../user-workflow-rules';

describe('user workflow rules and templates (BIZ-USER-01A D4, DECISION B)', () => {
  it('USER_WORKFLOW_RULES equals the Chief of Staff rules part', () => {
    const chiefOfStaff = systemAgentById('chief-of-staff');
    expect(chiefOfStaff).toBeDefined();
    expect(USER_WORKFLOW_RULES).toBe(chiefOfStaff!.rules);
    expect(USER_WORKFLOW_RULES.length).toBeGreaterThan(0);
  });

  it('the template allowlist is the Chief of Staff only', () => {
    expect([...USER_WORKFLOW_TEMPLATE_IDS]).toEqual(['chief-of-staff']);
  });

  it('every template id is a system agent', () => {
    const ids = SYSTEM_AGENT_DEFINITIONS.map((definition) => definition.id);
    for (const id of USER_WORKFLOW_TEMPLATE_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('isUserWorkflowTemplateId refuses other system agents and non-strings', () => {
    expect(isUserWorkflowTemplateId('chief-of-staff')).toBe(true);
    expect(isUserWorkflowTemplateId('product-strategy')).toBe(false);
    expect(isUserWorkflowTemplateId('builder')).toBe(false);
    expect(isUserWorkflowTemplateId(undefined)).toBe(false);
    expect(isUserWorkflowTemplateId(['chief-of-staff'])).toBe(false);
  });
});
