'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collaborationFetch } from '@/lib/collaboration/api';

/**
 * COS-FRONTDOOR-01C: the Chief of Staff's roster on the Team page. The page
 * reads GET /api/collaboration/roster ({ members, choices }), saves with
 * PUT /api/collaboration/roster { memberIds }, and reads roster.skipped from
 * the start response and agents from the run detail. The roster, the agent
 * list and the snapshots are server-side; nothing of a member's spec is read
 * or sent from the browser.
 */

/** At most three members; the Chief of Staff makes the fourth agent of a run. */
export const ROSTER_MAX_MEMBERS = 3;

export const ROSTER_REASONS = [
  'draft',
  'not_tested',
  'off',
  'missing',
  'coming_soon',
  'invalid',
] as const;
export type RosterReason = (typeof ROSTER_REASONS)[number];

/** The translation key (collaboration namespace) of each reason. */
export const ROSTER_REASON_KEYS: Readonly<Record<RosterReason, string>> = {
  draft: 'rosterReasonDraft',
  not_tested: 'rosterReasonNotTested',
  off: 'rosterReasonOff',
  missing: 'rosterReasonMissing',
  coming_soon: 'rosterReasonComingSoon',
  invalid: 'rosterReasonInvalid',
};

export interface RosterMember {
  id: string;
  kind: 'system' | 'workflow';
  name: string | null;
  usable: boolean;
  reason: RosterReason | null;
}

export interface RosterView {
  members: RosterMember[];
  choices: RosterMember[];
}

export type RosterLoadState = 'loading' | 'failed' | 'loaded';
export type RosterSaveState = 'idle' | 'saving' | 'saved' | 'failed';
export type RosterSaveErrorKey = 'rosterSaveFailed' | 'rosterSaveMemberRefused' | 'rosterLimit';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readReason(value: unknown): RosterReason | null {
  return typeof value === 'string' && (ROSTER_REASONS as readonly string[]).includes(value)
    ? (value as RosterReason)
    : null;
}

function readMember(value: unknown): RosterMember | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  const kind = value.kind === 'workflow' ? 'workflow' : value.kind === 'system' ? 'system' : null;
  if (kind === null) {
    return null;
  }
  const usable = value.usable === true;
  // An unusable member always has a reason to show; an unknown one reads as invalid.
  const reason = usable ? null : (readReason(value.reason) ?? 'invalid');
  return {
    id: value.id,
    kind,
    name: typeof value.name === 'string' && value.name.trim().length > 0 ? value.name : null,
    usable,
    reason,
  };
}

function readMembers(value: unknown): RosterMember[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const out: RosterMember[] = [];
  for (const entry of value) {
    const member = readMember(entry);
    if (member && !seen.has(member.id)) {
      seen.add(member.id);
      out.push(member);
    }
  }
  return out;
}

/** Reads a GET or PUT body. Null when it is not a roster at all. */
export function readRoster(body: unknown): RosterView | null {
  if (!isRecord(body) || !Array.isArray(body.members) || !Array.isArray(body.choices)) {
    return null;
  }
  return { members: readMembers(body.members), choices: readMembers(body.choices) };
}

/** The ids a PUT sends: the picked members in order. Nothing else goes in the body. */
export function rosterSaveBody(memberIds: readonly string[]): { memberIds: string[] } {
  return { memberIds: [...memberIds] };
}

/**
 * Ticks or unticks a member. A fourth tick is refused: the list stays as it was
 * and `limitHit` is true so the picker can say why.
 */
export function toggleRosterMember(
  selected: readonly string[],
  id: string,
  max: number = ROSTER_MAX_MEMBERS,
): { selected: string[]; limitHit: boolean } {
  if (selected.includes(id)) {
    return { selected: selected.filter((entry) => entry !== id), limitHit: false };
  }
  if (selected.length >= max) {
    return { selected: [...selected], limitHit: true };
  }
  return { selected: [...selected, id], limitHit: false };
}

/** Maps a failed PUT to the translated message key shown under Save. */
export function rosterSaveErrorKey(status: number, body: unknown): RosterSaveErrorKey {
  const code = isRecord(body) && typeof body.code === 'string' ? body.code : '';
  if (code === 'ROSTER_TOO_MANY') {
    return 'rosterLimit';
  }
  if (
    code === 'ROSTER_MEMBER_NOT_FOUND' ||
    code === 'ROSTER_MEMBER_NOT_ALLOWED' ||
    code === 'ROSTER_MEMBER_UNKNOWN'
  ) {
    return 'rosterSaveMemberRefused';
  }
  void status;
  return 'rosterSaveFailed';
}

/**
 * The rows the picker shows: every choice, then any stored member that is no longer a
 * choice (for example a deleted workflow), so the owner can untick it.
 */
export function rosterPickerRows(view: RosterView): RosterMember[] {
  const rows = [...view.choices];
  const known = new Set(rows.map((row) => row.id));
  for (const member of view.members) {
    if (!known.has(member.id)) {
      rows.push(member);
    }
  }
  return rows;
}

export interface RosterSkipped {
  id: string;
  reason: RosterReason;
}

/** The members the server left out of a Chief of Staff start (`roster.skipped`). */
export function readStartSkipped(started: unknown): RosterSkipped[] {
  if (!isRecord(started) || !isRecord(started.roster) || !Array.isArray(started.roster.skipped)) {
    return [];
  }
  const out: RosterSkipped[] = [];
  for (const entry of started.roster.skipped) {
    if (isRecord(entry) && typeof entry.id === 'string' && entry.id.length > 0) {
      out.push({ id: entry.id, reason: readReason(entry.reason) ?? 'invalid' });
    }
  }
  return out;
}

/** `agents` on a run detail: the stored agent list with labels. */
export function readRunAgents(value: unknown): Array<{ name: string; label: string | null }> {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: Array<{ name: string; label: string | null }> = [];
  for (const entry of value) {
    if (isRecord(entry) && typeof entry.name === 'string' && entry.name.length > 0) {
      out.push({
        name: entry.name,
        label:
          typeof entry.label === 'string' && entry.label.trim().length > 0 ? entry.label : null,
      });
    }
  }
  return out;
}

/**
 * A step from an agent to the Chief of Staff is a report-back. The server writes its
 * prompt from the owner's task and the agent's answer.
 */
export function isReportBackHandoff(source: string, target: string): boolean {
  return (
    target === 'chief-of-staff' &&
    source !== 'chief-of-staff' &&
    source !== 'advisors-lead' &&
    source !== 'user' &&
    source.length > 0
  );
}

/**
 * The start body for the Chief of Staff. Without a session the body has no sessionId
 * (COS-FRONTDOOR-01B accepts that); the roster itself is never sent.
 */
export function collaborationChiefStartBody(input: { sessionId?: string; task: string }): {
  sessionId?: string;
  task: string;
  team: 'chief-of-staff';
} {
  const sessionId = input.sessionId?.trim() ?? '';
  return {
    ...(sessionId.length > 0 ? { sessionId } : {}),
    task: input.task.trim(),
    team: 'chief-of-staff',
  };
}

export interface CollaborationRoster {
  state: RosterLoadState;
  members: RosterMember[];
  choices: RosterMember[];
  /** The ticked member ids, in order. Starts as the saved roster. */
  selectedIds: string[];
  saveState: RosterSaveState;
  saveErrorKey: RosterSaveErrorKey | null;
  /** True after a fourth tick was refused, until the list changes again. */
  limitHit: boolean;
  /** The ticked list differs from the saved roster. */
  dirty: boolean;
  onToggle: (id: string) => void;
  onSave: () => void;
  onRetry: () => void;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

/**
 * Loads the owner's roster the first time `enabled` turns true, and keeps the ticked
 * list while the owner switches teams back and forth.
 */
export function useCollaborationRoster(enabled: boolean): CollaborationRoster {
  const [requested, setRequested] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<RosterLoadState>('loading');
  const [view, setView] = useState<RosterView>({ members: [], choices: [] });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<RosterSaveState>('idle');
  const [saveErrorKey, setSaveErrorKey] = useState<RosterSaveErrorKey | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    if (enabled) {
      setRequested(true);
    }
  }, [enabled]);

  useEffect(() => {
    if (!requested) {
      return;
    }
    let cancelled = false;
    setState('loading');
    collaborationFetch('/api/collaboration/roster')
      .then(async (response) => {
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setState('failed');
          return;
        }
        const next = readRoster(await response.json());
        if (cancelled) {
          return;
        }
        if (!next) {
          setState('failed');
          return;
        }
        setView(next);
        setSelectedIds(next.members.map((member) => member.id));
        setSaveState('idle');
        setSaveErrorKey(null);
        setLimitHit(false);
        setState('loaded');
      })
      .catch(() => {
        if (!cancelled) {
          setState('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requested, generation]);

  const onRetry = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  const onToggle = useCallback(
    (id: string) => {
      if (saving.current) {
        return;
      }
      const next = toggleRosterMember(selectedIds, id);
      setSelectedIds(next.selected);
      setLimitHit(next.limitHit);
      if (!next.limitHit) {
        setSaveState('idle');
        setSaveErrorKey(null);
      }
    },
    [selectedIds],
  );

  const onSave = useCallback(() => {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setSaveState('saving');
    setSaveErrorKey(null);
    setLimitHit(false);
    void (async () => {
      try {
        const response = await collaborationFetch('/api/collaboration/roster', {
          method: 'PUT',
          body: JSON.stringify(rosterSaveBody(selectedIds)),
        });
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        const next = response.ok ? readRoster(body) : null;
        if (!next) {
          setSaveState('failed');
          setSaveErrorKey(response.ok ? 'rosterSaveFailed' : rosterSaveErrorKey(response.status, body));
          return;
        }
        setView(next);
        setSelectedIds(next.members.map((member) => member.id));
        setSaveState('saved');
      } catch {
        setSaveState('failed');
        setSaveErrorKey('rosterSaveFailed');
      } finally {
        saving.current = false;
      }
    })();
  }, [selectedIds]);

  return {
    state,
    members: view.members,
    choices: view.choices,
    selectedIds,
    saveState,
    saveErrorKey,
    limitHit,
    dirty: !sameList(
      selectedIds,
      view.members.map((member) => member.id),
    ),
    onToggle,
    onSave,
    onRetry,
  };
}
