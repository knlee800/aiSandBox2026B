import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConnectorBroker } from './connector-broker';
import { assertConnectorCredentialsConfigured } from './connector-crypto';
import {
  CONNECTOR_GRANT_REFUSED_MESSAGE,
  isConnectorCallGranted,
} from './connector-grant-token';

/**
 * Internal connector call for the harness.
 * POST /api/internal/connectors/call
 * Body: { userId, toolId, arguments, executionId, grantToken }
 *
 * Protected by the global InternalServiceAuthGuard (X-Internal-Service-Key).
 * CONN-GRANT-01: the per-job grant token minted by the gateway when it built
 * the job must be valid for this execution, user and tool, or the call is
 * refused with 403 and a fixed message before the broker runs. The token is
 * never logged or audited.
 */
@Controller('internal/connectors')
export class InternalConnectorsController {
  constructor(private readonly broker: ConnectorBroker) {}

  @Post('call')
  @HttpCode(HttpStatus.OK)
  async call(@Body() body: unknown): Promise<unknown> {
    const record = readRecord(body);
    // A missing or invalid credentials key keeps the CONN-02A 503.
    assertConnectorCredentialsConfigured();
    const granted = isConnectorCallGranted({
      grantToken: record.grantToken,
      executionId: record.executionId,
      userId: record.userId,
      toolId: record.toolId,
      nowMs: Date.now(),
    });
    if (!granted) {
      throw new ForbiddenException(CONNECTOR_GRANT_REFUSED_MESSAGE);
    }
    const called = await this.broker.callConnectorTool({
      userId: record.userId,
      toolId: record.toolId,
      args: record.arguments,
      action: 'connector_call',
      serverId: record.serverId,
    });
    return called.result;
  }
}

function readRecord(body: unknown): {
  userId: unknown;
  toolId: unknown;
  arguments: unknown;
  serverId: unknown;
  executionId: unknown;
  grantToken: unknown;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      userId: undefined,
      toolId: undefined,
      arguments: undefined,
      serverId: undefined,
      executionId: undefined,
      grantToken: undefined,
    };
  }
  const record = body as Record<string, unknown>;
  let serverId: unknown;
  if (record.server !== undefined) serverId = record.server;
  else if (record.serverId !== undefined) serverId = record.serverId;
  else if (record.url !== undefined) serverId = record.url;
  return {
    userId: record.userId,
    toolId: record.toolId,
    arguments: record.arguments,
    serverId,
    executionId: record.executionId,
    grantToken: record.grantToken,
  };
}
