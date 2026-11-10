import { findAllowlistedTool } from '../connectors/connector-servers';
import { KNOWLEDGE_SCOPES, findKnowledgeScope } from '../knowledge/knowledge-scopes';

/**
 * BIZ-USER-01A D7: what a user workflow may be granted.
 *
 * Grants = the stored spec intersected with the platform allowlist and,
 * for connector tools, with the kinds the owner has connected. This is the
 * only derivation: saves refuse when anything would be dropped, and the run
 * path (BIZ-USER-01C) signs only this function's output. A value outside
 * the allowlist can never widen a grant.
 */

/** A business workflow is read-only. */
export const USER_WORKFLOW_TOOL_PROFILES = ['read'] as const;
export type UserWorkflowToolProfile = (typeof USER_WORKFLOW_TOOL_PROFILES)[number];

export const MAX_USER_WORKFLOW_KNOWLEDGE_SCOPES = KNOWLEDGE_SCOPES.length;

export interface UserWorkflowAccessInput {
  readonly toolProfile: unknown;
  readonly knowledgeScopeIds: unknown;
  readonly connectorToolIds: unknown;
}

export interface UserWorkflowMissingConnection {
  readonly toolId: string;
  readonly kind: string;
}

export interface UserWorkflowGrants {
  readonly toolProfile: UserWorkflowToolProfile;
  /** Catalogue ids only, deduplicated, in catalogue order. */
  readonly knowledgeScopeIds: string[];
  /** Allowlisted ids whose kind the owner has connected, deduplicated, in input order. */
  readonly connectorToolIds: string[];
  readonly dropped: {
    /** The requested profile when it was not allowed (replaced by `read`); else null. */
    readonly toolProfile: string | null;
    /** Ids that are not in the scope catalogue. */
    readonly knowledgeScopeIds: string[];
    /** Ids that are not in the connector tool allowlist. */
    readonly connectorToolIds: string[];
    /** Allowlisted tools whose kind the owner has not connected. */
    readonly missingConnections: UserWorkflowMissingConnection[];
  };
}

function isUserWorkflowToolProfile(value: unknown): value is UserWorkflowToolProfile {
  return (
    typeof value === 'string' &&
    (USER_WORKFLOW_TOOL_PROFILES as readonly string[]).includes(value)
  );
}

function listOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Allowlisted connector tool ids, deduplicated, in input order. Unknown ids are left out. */
export function allowlistedConnectorToolIds(ids: unknown): string[] {
  const kept: string[] = [];
  for (const id of listOf(ids)) {
    const tool = findAllowlistedTool(id);
    if (tool && !kept.includes(tool.id)) {
      kept.push(tool.id);
    }
  }
  return kept;
}

export function userWorkflowGrants(
  access: UserWorkflowAccessInput,
  ownerConnectionKinds: Iterable<string>,
): UserWorkflowGrants {
  const kinds = new Set<string>(ownerConnectionKinds);

  const toolProfile: UserWorkflowToolProfile = 'read';
  const droppedToolProfile = isUserWorkflowToolProfile(access.toolProfile)
    ? null
    : String(access.toolProfile);

  const requestedScopes = new Set<string>();
  const droppedScopes: string[] = [];
  for (const id of listOf(access.knowledgeScopeIds)) {
    const scope = typeof id === 'string' ? findKnowledgeScope(id) : undefined;
    if (scope) {
      requestedScopes.add(scope.id);
    } else if (!droppedScopes.includes(String(id))) {
      droppedScopes.push(String(id));
    }
  }
  const knowledgeScopeIds = KNOWLEDGE_SCOPES.map((scope) => scope.id)
    .filter((id) => requestedScopes.has(id))
    .slice(0, MAX_USER_WORKFLOW_KNOWLEDGE_SCOPES);

  const connectorToolIds: string[] = [];
  const droppedTools: string[] = [];
  const missingConnections: UserWorkflowMissingConnection[] = [];
  const seenTools = new Set<string>();
  for (const id of listOf(access.connectorToolIds)) {
    const tool = findAllowlistedTool(id);
    if (!tool) {
      if (!droppedTools.includes(String(id))) {
        droppedTools.push(String(id));
      }
      continue;
    }
    if (seenTools.has(tool.id)) {
      continue;
    }
    seenTools.add(tool.id);
    if (kinds.has(tool.kind)) {
      connectorToolIds.push(tool.id);
    } else {
      missingConnections.push({ toolId: tool.id, kind: tool.kind });
    }
  }

  return {
    toolProfile,
    knowledgeScopeIds,
    connectorToolIds,
    dropped: {
      toolProfile: droppedToolProfile,
      knowledgeScopeIds: droppedScopes,
      connectorToolIds: droppedTools,
      missingConnections,
    },
  };
}
