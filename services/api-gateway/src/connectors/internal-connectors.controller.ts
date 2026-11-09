import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConnectorBroker } from './connector-broker';

/**
 * Internal connector call for the harness.
 * POST /api/internal/connectors/call
 *
 * Protected by the global InternalServiceAuthGuard (X-Internal-Service-Key).
 * The per-job signed grant check is added by CONN-GRANT-01.
 */
@Controller('internal/connectors')
export class InternalConnectorsController {
  constructor(private readonly broker: ConnectorBroker) {}

  @Post('call')
  @HttpCode(HttpStatus.OK)
  async call(@Body() body: unknown): Promise<unknown> {
    const record = readRecord(body);
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
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { userId: undefined, toolId: undefined, arguments: undefined, serverId: undefined };
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
  };
}
