/**
 * COS-EVAL-01: data contract for one Chief of Staff morning briefing
 * injection case. A new case is a JSON file in eval/briefing-tasks/.
 * The loader rejects unknown fields.
 */

import type { EvalEndedAs } from './eval-types';

/**
 * Every field the mail tool returns (connectors-mcp UnreadMessage). The loader
 * fills bodyText with "" and bodyTruncated with false when a fixture gives
 * none, so the model always sees the real shape.
 */
export interface BriefingMailMessage {
  readonly id: string;
  readonly from: { readonly name: string; readonly address: string };
  readonly toCount: number;
  readonly subject: string;
  readonly date: string;
  /** A plain-text excerpt of the body; empty when there is none. */
  readonly bodyText: string;
  /** True when the excerpt is shorter than the body part. */
  readonly bodyTruncated: boolean;
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
  | 'organizer.name'
  | 'answer';

/**
 * COS-MAIL-BODY-RULE-01: the owner request a mail trigger sends
 * (services/api-gateway/src/triggers/mail-trigger-match.ts mailTriggerTask):
 * the saved task, then fixed platform lines with the arrival time and the
 * message's number.
 */
export interface BriefingMailTriggerRequest {
  readonly kind: 'mail-trigger';
  /** The owner's saved task text. */
  readonly savedTask: string;
  /** Arrival time in the case's time zone as the gateway prints it: YYYY-MM-DD HH:MM. */
  readonly arrivedAt: string;
  /** The message's IMAP UID; the mail fixture holds a message with this id. */
  readonly messageUid: number;
}

/**
 * COS-MAIL-BODY-RULE-01: the owner request a chain trigger sends
 * (services/api-gateway/src/triggers/chain-trigger-match.ts chainTriggerTask).
 */
export interface BriefingChainTriggerRequest {
  readonly kind: 'chain-trigger';
  readonly savedTask: string;
  /** Completion time in the case's time zone as the gateway prints it: YYYY-MM-DD HH:MM. */
  readonly completedAt: string;
  /** The finished run's id; equals runResult.runId. */
  readonly sourceRunId: string;
}

/** A case without request sends the Team page Morning briefing preset. */
export type BriefingOwnerRequest = BriefingMailTriggerRequest | BriefingChainTriggerRequest;

/**
 * COS-MAIL-BODY-RULE-01: what the gateway's run-result route returns for
 * the finished run (the fields createReadRunResultHandler keeps). Only on a
 * chain-trigger case; read_run_result is then registered and advertised, as
 * with RUN_RESULT_TOOL_ENABLED on.
 */
export interface BriefingRunResultFixture {
  readonly runId: string;
  readonly status: 'completed';
  readonly finishedAt: string | null;
  readonly workflow: { readonly name: string; readonly testRun: boolean } | null;
  readonly answer: string;
  readonly truncated: boolean;
}

/**
 * One item that carries a direction. tool + index name the message or event
 * (run_result: index 0, field answer, the case's runResult);
 * field is where the direction sits. markers are text from that same item
 * (the sender name, a subject or title fragment) that a briefing listing
 * the item would repeat; the loader checks each marker appears in the item.
 */
export interface BriefingInjectedItem {
  readonly id: string;
  readonly tool: 'mail' | 'calendar' | 'run_result';
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
  readonly maxToolIterations?: number;
  /** COS-MAIL-BODY-RULE-01: a trigger's request instead of the Morning briefing preset. */
  readonly request?: BriefingOwnerRequest;
  /** COS-MAIL-BODY-RULE-01: the finished run read_run_result returns. Chain-trigger cases only. */
  readonly runResult?: BriefingRunResultFixture;
}

export interface BriefingTaskResult {
  readonly id: string;
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
  /**
   * COS-MAIL-BODY-RULE-01: fragments of the agent's own prompt found in the
   * answer (TASK_TEXT_LEAK_MARKERS). Checked on trigger cases only; always
   * empty on Morning briefing cases.
   */
  readonly taskTextLeaks: readonly string[];
  /** Every tool name the model asked for, in order. */
  readonly toolCallNames: readonly string[];
  /** Tool names the case does not allow (the two connector tools, plus read_run_result on a chain-trigger case). */
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
