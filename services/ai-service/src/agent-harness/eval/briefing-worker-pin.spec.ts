import * as fs from 'fs';
import * as path from 'path';

/**
 * COS-EVAL-01 worker pin.
 *
 * briefing-prompt.ts rebuilds the worker's harness prompt by calling the
 * worker's exported helpers (buildExecutionPromptParts, then
 * withWorkerHarnessInstructions, then buildAIExecutionRequest). That only
 * matches production while the worker itself still builds the prompt that
 * way. This spec reads worker.processor.ts as text (fs only; the file is not
 * edited or executed) and fails unless, for a harness run:
 *   - the grant is resolved from the job and the signed tool profile,
 *   - the base prompt comes from buildExecutionPromptParts with the job's
 *     prompt, workspace context, global and project instructions, and
 *     useHarness plus the resolved execution intent,
 *   - promptParts is withWorkerHarnessInstructions(basePromptParts,
 *     { connectorTools: connectorGrant.tools.length > 0 }) on the harness
 *     path and basePromptParts otherwise, and it is called exactly once,
 *   - that promptParts is what buildAIExecutionRequest receives,
 *   - connector tools are registered with createConnectorToolHandler and
 *     their definitions are appended to the advertised tools.
 * All whitespace is removed before matching, so formatting changes do not
 * fail it; a trailing comma is optional. If the worker changes this path,
 * update briefing-prompt.ts and this pin together.
 */
const WORKER_PATH = path.join(__dirname, '..', '..', 'worker', 'worker.processor.ts');

function squash(text: string): string {
  return text.replace(/\s+/g, '');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pattern built from code with whitespace removed; ",?" before ) or } stays optional. */
function codePattern(code: string): RegExp {
  const parts = squash(code).split('<,?>').map(escapeRegExp);
  return new RegExp(parts.join(',?'));
}

describe('COS-EVAL-01 pin on the worker harness prompt path', () => {
  const source = squash(fs.readFileSync(WORKER_PATH, 'utf8'));

  it('imports the connector helpers the eval uses', () => {
    expect(source).toContain(
      squash("import { resolveConnectorGrants, withWorkerHarnessInstructions } from './connector-grants';"),
    );
    expect(source).toContain(
      squash(
        "import { createConnectorToolHandler } from '../agent-harness/tools/handlers/connector-tool-handlers';",
      ),
    );
  });

  it('derives connectorTools from the granted connector tools when it builds the harness prompt', () => {
    expect(source).toContain(
      squash('const connectorGrant = resolveConnectorGrants(job.data, signedToolProfile);'),
    );
    expect(source).toMatch(
      codePattern(`
        const basePromptParts = buildExecutionPromptParts(
          job.data.prompt ?? '',
          job.data.workspaceContext,
          job.data.globalInstructions,
          job.data.projectInstructions,
          {
            useHarness,
            executionIntent: resolveWorkerExecutionIntent(
              job.data.executionIntent<,?>
            )<,?>
          }<,?>
        );
        const promptParts = useHarness
          ? withWorkerHarnessInstructions(basePromptParts, {
              connectorTools: connectorGrant.tools.length > 0,
              runResultTool: runResultGranted<,?>
            })
          : basePromptParts;
        const executionRequest = buildAIExecutionRequest(
          job.data,
          promptParts,
      `),
    );
    expect(source.split('withWorkerHarnessInstructions(').length - 1).toBe(1);
  });

  it('registers granted connector tools with the real handler and advertises their definitions', () => {
    expect(source).toContain(squash('createConnectorToolHandler({'));
    expect(source).toContain(
      squash('connectorToolDefinitions.push(getConnectorToolDefinition(connectorToolId));'),
    );
    expect(source).toContain(squash('...connectorToolDefinitions,'));
  });

  it('COS-MAIL-BODY-RULE-01: registers read_run_result under the signed grant, after the connector tools, with the real handler', () => {
    expect(source).toContain(
      squash('const runResultGranted = resolveRunResultGrant(job.data, signedToolProfile);'),
    );
    expect(source).toMatch(
      codePattern(`
        if (signedToolProfile === 'read' && runResultGranted) {
          dispatcher.registerHandler(
            'read_run_result',
            wrapHarnessTool(
              'read_run_result',
              createReadRunResultHandler({
                client: this.apiGatewayHttpClient,
                userId: job.data.userId,
                maxToolResultBytes: resolvedConfig.maxToolResultBytes<,?>
              })<,?>
            )<,?>
          );
          registeredHandlerNames.push('read_run_result');
        }
      `),
    );
    // Registered after the connector tools, so the eval's registered list puts it last.
    expect(source.indexOf(squash("registeredHandlerNames.push('read_run_result');"))).toBeGreaterThan(
      source.indexOf(squash('registeredHandlerNames.push(connectorToolId);')),
    );
  });
});
