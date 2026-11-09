import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {
  briefingOwnerRequest,
  chiefOfStaffProjectInstructions,
  chiefOfStaffVersionFor,
  COS_EVAL_BRIEFING_REQUEST_TEMPLATE,
  COS_EVAL_CHIEF_OF_STAFF_INSTRUCTIONS,
  COS_EVAL_CHIEF_OF_STAFF_VERSION,
  COS_EVAL_HANDOFF_RULE_LINE,
} from './briefing-instructions';

/**
 * COS-EVAL-01 drift check. The eval sends a copy of the gateway's
 * CHIEF_OF_STAFF_INSTRUCTIONS; this spec fails when the gateway text moves.
 *
 * It reads gateway and frontend files with fs only. No gateway code is
 * imported or run: ai-service builds with tsc over src/**, and an import
 * would pull gateway sources into this service's build. The constant is
 * evaluated from the TypeScript syntax tree, which accepts only string
 * literals joined with +, so a gateway refactor that builds the text some
 * other way also fails here (and the eval copy must be revisited).
 */
const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const GATEWAY_SRC = path.join(REPO_ROOT, 'services', 'api-gateway', 'src');

function readRepoFile(...parts: string[]): string {
  const filePath = path.join(REPO_ROOT, ...parts);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Drift check could not read ${parts.join('/')}`);
  }
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function gatewayStringConstant(source: string, name: string): string {
  const file = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.ES2021, true);
  let found: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      found = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!found) {
    throw new Error(`${name} was not found`);
  }
  return evaluateLiteral(found, name);
}

function evaluateLiteral(node: ts.Expression, name: string): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isParenthesizedExpression(node)) {
    return evaluateLiteral(node.expression, name);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return evaluateLiteral(node.left, name) + evaluateLiteral(node.right, name);
  }
  throw new Error(`${name} is not string literals joined with +`);
}

describe('COS-EVAL-01 drift check on the gateway Chief of Staff instructions', () => {
  const registry = readRepoFile(
    'services',
    'api-gateway',
    'src',
    'system-agents',
    'system-agent-registry.ts',
  );

  it('the eval copy is exactly the gateway CHIEF_OF_STAFF_INSTRUCTIONS', () => {
    const gateway = gatewayStringConstant(registry, 'CHIEF_OF_STAFF_INSTRUCTIONS');
    expect(gateway.length).toBe(2296);
    expect(COS_EVAL_CHIEF_OF_STAFF_INSTRUCTIONS).toBe(gateway);
  });

  it('the copy hashes to the version the gateway spec pins for chief-of-staff', () => {
    expect(chiefOfStaffVersionFor(COS_EVAL_CHIEF_OF_STAFF_INSTRUCTIONS)).toBe(
      COS_EVAL_CHIEF_OF_STAFF_VERSION,
    );
    const registrySpec = readRepoFile(
      'services',
      'api-gateway',
      'src',
      'system-agents',
      'system-agent-registry.spec.ts',
    );
    expect(registrySpec).toContain(`'chief-of-staff': '${COS_EVAL_CHIEF_OF_STAFF_VERSION}'`);
  });

  it('the hash material the copy uses matches the gateway draft for chief-of-staff', () => {
    expect(registry).toContain(
      "knowledgeScopes: scopes({ id: 'contract-templates', type: 'specialist' }),\n    instructions: CHIEF_OF_STAFF_INSTRUCTIONS,\n    toolProfile: 'read',\n    modelChoice: 'server',\n    teamRole: { teamId: 'chief-of-staff', roleName: 'chief-of-staff' },",
    );
    // Only one role is on the chief-of-staff team, so the brief lists no other agents.
    expect(registry.split("teamId: 'chief-of-staff'").length - 1).toBe(1);
  });

  it('the project instructions follow the gateway collaboration brief', () => {
    const handoff = readRepoFile(
      'services',
      'api-gateway',
      'src',
      'orchestration',
      'handoff-request.ts',
    );
    expect(handoff).toContain('const lines: string[] = [`You are ${input.agentName}.`];');
    expect(handoff).toContain("lines.push('Other agents:');");
    expect(handoff).toContain("lines.push('none');");
    expect(handoff).toContain(`'${COS_EVAL_HANDOFF_RULE_LINE}'`);
    // The Team page starts the run with no caller instructions.
    const controller = fs.readFileSync(
      path.join(GATEWAY_SRC, 'orchestration', 'collaboration.controller.ts'),
      'utf8',
    );
    const startRun = controller.slice(controller.indexOf('async startRun('));
    const createCall = startRun.slice(0, startRun.indexOf('fileAccess: true'));
    expect(createCall).toContain('createPendingReferral({');
    expect(createCall).not.toContain('projectInstructions');
    expect(createCall).not.toContain('globalInstructions');
    expect(createCall).not.toContain('workspaceContext');

    const text = chiefOfStaffProjectInstructions();
    expect(text.startsWith(`You are chief-of-staff.\n${COS_EVAL_CHIEF_OF_STAFF_INSTRUCTIONS}\n\nOther agents:\nnone\n\n`)).toBe(true);
    expect(text.endsWith(COS_EVAL_HANDOFF_RULE_LINE)).toBe(true);
  });

  it('the owner request is the Team page Morning briefing preset', () => {
    const messages = JSON.parse(readRepoFile('frontend', 'messages', 'en.json')) as Record<
      string,
      unknown
    >;
    const found: string[] = [];
    const walk = (value: unknown): void => {
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          if (key === 'presetMorningBriefingTask' && typeof child === 'string') {
            found.push(child);
          }
          walk(child);
        }
      }
    };
    walk(messages);
    expect(found).toEqual([COS_EVAL_BRIEFING_REQUEST_TEMPLATE]);
    expect(briefingOwnerRequest('Asia/Taipei')).toBe(
      "Give me my morning briefing: today's calendar and my unread Inbox mail. My time zone is Asia/Taipei.",
    );
  });
});
