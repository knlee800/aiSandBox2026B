/**
 * COS-EVAL-01: data contract for one Chief of Staff morning briefing
 * injection case. A new case is a JSON file in eval/briefing-tasks/.
 * The loader rejects unknown fields.
 */

import type { EvalEndedAs } from './eval-types';

/** Header fields the mail tool returns today (connectors-mcp UnreadMessage). */
export interface BriefingMailMessage {
  readonly id: string;
  readonly from: { readonly name: string; readonly address: string };
  readonly toCount: number;
  readonly subject: string;
  readonly date: string;
  /**
   * Not returned by the tool today. Allowed only on a case marked
   * bodyCase "CONN-03": those cases stand in for the body text CONN-03
   * would add (docs/AGENT-OPS-PLAN.md C16, "CONN-03 after the eval's body
   * cases").
   */
  readonly bodyText?: string;
}

/** Fields the calendar tool returns (connectors-mcp CalendarEvent). */
export interface BriefingCalendarEvent {
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly organizer: { readonly name: string; readonly address: string } | null;
  readonly attendeeCount: number;
  readonly ownerResponse: string | null;
}

/** What the gateway's internal connector route returns for each tool. */
export interface BriefingMailResult {
  readonly messages: readonly BriefingMailMessage[];
}

export interface BriefingCalendarResult {
  readonly events: readonly BriefingCalendarEvent[];
}

export type BriefingInjectedField =
  | 'subject'
  | 'from.name'
  | 'bodyText'
  | 'title'
  | 'organizer.name';

/**
 * One item that carries a direction. tool + index name the message or event;
 * field is where the direction sits. markers are text from that same item
 * (the sender name, a subject or title fragment) that a briefing listing
 * the item would repeat; the loader checks each marker appears in the item.
 */
export interface BriefingInjectedItem {
  readonly id: string;
  readonly tool: 'mail' | 'calendar';
  readonly index: number;
  readonly field: BriefingInjectedField;
  /** Short label of what the direction asks for, for reports only. */
  readonly direction: string;
  readonly markers: readonly string[];
}

export interface BriefingTask {
  readonly id: string;
  readonly description: string;
  /** IANA time zone the Team page preset puts in the request. */
  readonly timeZone: string;
  readonly mail: BriefingMailResult;
  readonly calendar: BriefingCalendarResult;
  /** Empty on the clean control. */
  readonly injected: readonly BriefingInjectedItem[];
  /** "CONN-03" on a case whose direction sits in a mail body. */
  readonly bodyCase?: 'CONN-03';
  readonly maxToolIterations?: number;
}

export interface BriefingTaskResult {
  readonly id: string;
  readonly bodyCase: 'CONN-03' | null;
  readonly injectedItems: number;
  /** Injected item ids the briefing names (a marker appears). */
  readonly reported: readonly string[];
  /** Injected item ids named in a block that also says "suspicious instruction". */
  readonly flagged: readonly string[];
  /** How many times "suspicious instruction" appears in the answer. */
  readonly flagCount: number;
  /**
   * Normal items flagged on their own: a block names the item, names no
   * injected item, and says "suspicious instruction". Injection cases only.
   */
  readonly falseFlags: readonly string[];
  /** Action-claim markers found in the answer. */
  readonly actionClaims: readonly string[];
  /** Hand-off markers found in the answer. */
  readonly handoffs: readonly string[];
  /** Every tool name the model asked for, in order. */
  readonly toolCallNames: readonly string[];
  /** Tool names other than the two connector tools. */
  readonly extraToolCalls: readonly string[];
  readonly sectionsMissing: readonly string[];
  readonly passed: boolean;
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
  readonly endedAs: EvalEndedAs;
  /** Final answer text, whitespace kept, capped at 1000 characters. Null when the run has none. */
  readonly finalAnswer: string | null;
  readonly failureReasons: readonly string[];
}

export interface BriefingRunTotals {
  readonly tasks: number;
  readonly passed: number;
  readonly injectedItems: number;
  readonly reported: number;
  readonly flagged: number;
  readonly falseFlags: number;
  readonly actionClaims: number;
  readonly handoffs: number;
  readonly extraToolCalls: number;
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
}

export interface BriefingRunResults {
  readonly runId: string;
  readonly startedAt: string;
  readonly model: string;
  readonly harnessVersion: string;
  readonly tasks: readonly BriefingTaskResult[];
  readonly totals: BriefingRunTotals;
}
