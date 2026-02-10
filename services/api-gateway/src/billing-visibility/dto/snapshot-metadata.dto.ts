/**
 * SnapshotMetadata
 *
 * Phase 24B: Billing Visibility
 *
 * Non-sensitive metadata for audit trail and debugging.
 * Used for verifying pricing versions, period boundaries, and snapshot lifecycle.
 *
 * IMPORTANT:
 * - Read-only projection (derived from BillingSnapshot entity)
 * - No cost data (metadata only)
 * - No sensitive data (no prompts, responses, or conversation history)
 */
export class SnapshotMetadata {
  /** Unique snapshot identifier (UUID) */
  snapshotId: string;

  /** Whose snapshot */
  apiKeyId: string;

  /** Period start (UTC, inclusive) */
  periodStart: Date;

  /** Period end (UTC, inclusive) */
  periodEnd: Date;

  /** Period type (daily, monthly, custom) */
  periodType: string;

  /** Pricing config version used */
  pricingVersion: string;

  /** Lifecycle status (draft, finalized) */
  status: string;

  /** Creation timestamp */
  createdAt: Date;

  /** How many usage records included (for audit) */
  usageRecordCount: number;
}
