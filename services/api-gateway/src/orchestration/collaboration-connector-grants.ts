import { assertConnectorCredentialsConfigured } from '../connectors/connector-crypto';
import {
  mintConnectorGrantToken,
  normalizeConnectorToolIds,
} from '../connectors/connector-grant-token';
import { findAllowlistedTool } from '../connectors/connector-servers';

/**
 * CONN-GRANT-01: owner connection rows, read by owner id only.
 * The secret columns are never read here.
 */
export interface ConnectorConnectionKindLookup {
  find(options: {
    where: { userId: string };
    select?: Array<'userId' | 'kind'>;
  }): Promise<ReadonlyArray<{ userId: string; kind: string }>>;
}

export interface ConnectorGrantJobFields {
  connectorGrants?: string[];
  connectorGrantToken?: string;
}

export type ConnectorGrantOutcome =
  | 'not_eligible'
  | 'no_role_tools'
  | 'not_configured'
  | 'lookup_failed'
  | 'no_connection'
  | 'mint_failed'
  | 'granted';

/**
 * {} unless the job is a signed harness v1 read-profile job, the role lists
 * connector tools, the credentials key is configured, and the owner has a
 * connection of each granted tool's kind. Otherwise { connectorGrants (sorted),
 * connectorGrantToken }. Both fields are then covered by the entitlement proof.
 * Never throws: any failure means no grant.
 */
export async function resolveConnectorGrantJobFields(input: {
  readonly executionId: string;
  readonly userId: string;
  readonly harnessVersion?: unknown;
  readonly harnessToolProfile?: unknown;
  readonly roleToolIds: readonly string[];
  readonly connections?: ConnectorConnectionKindLookup;
  readonly nowMs: number;
}): Promise<{ fields: ConnectorGrantJobFields; outcome: ConnectorGrantOutcome }> {
  if (input.harnessVersion !== 'v1' || input.harnessToolProfile !== 'read') {
    return { fields: {}, outcome: 'not_eligible' };
  }
  const roleTools = normalizeConnectorToolIds(input.roleToolIds);
  if (roleTools.length === 0) {
    return { fields: {}, outcome: 'no_role_tools' };
  }
  if (!input.connections) {
    return { fields: {}, outcome: 'not_configured' };
  }
  try {
    assertConnectorCredentialsConfigured();
  } catch {
    return { fields: {}, outcome: 'not_configured' };
  }
  let kinds: Set<string>;
  try {
    const rows = await input.connections.find({
      where: { userId: input.userId },
      select: ['userId', 'kind'],
    });
    kinds = new Set(
      rows.filter((row) => row.userId === input.userId).map((row) => row.kind),
    );
  } catch {
    return { fields: {}, outcome: 'lookup_failed' };
  }
  const granted = roleTools.filter((id) => {
    const tool = findAllowlistedTool(id);
    return tool !== null && kinds.has(tool.kind);
  });
  if (granted.length === 0) {
    return { fields: {}, outcome: 'no_connection' };
  }
  let token: string;
  try {
    token = mintConnectorGrantToken({
      executionId: input.executionId,
      userId: input.userId,
      tools: granted,
      nowMs: input.nowMs,
    });
  } catch {
    return { fields: {}, outcome: 'mint_failed' };
  }
  return {
    fields: { connectorGrants: granted, connectorGrantToken: token },
    outcome: 'granted',
  };
}
