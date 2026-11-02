import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ListedRunRow {
  execution_id: string | null;
  session_id: string | null;
  execution_status: string | null;
  provider: string | null;
  model: string | null;
  tokens_used: number | string | null;
  execution_duration_ms: number | string | null;
  timestamp: Date | string | null;
  runMode: string | null;
  agentId: string | null;
}

@Injectable()
export class ExecutionResultService {
  constructor(private readonly dataSource: DataSource) {}

  async getExecution(executionId: string) {
    const result = await this.dataSource.query(
      `
      SELECT
        execution_id,
        user_id,
        execution_status,
        provider,
        model,
        tokens_used,
        metadata
      FROM usage_records
      WHERE execution_id = $1
      `,
      [executionId],
    );

    const row = result[0] ?? null;
    if (!row) {
      return null;
    }

    const metadata = row.metadata;
    let parsedMetadata: Record<string, unknown> | null = null;

    if (metadata && typeof metadata === 'object') {
      parsedMetadata = metadata as Record<string, unknown>;
    } else if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata) as unknown;
        if (parsed && typeof parsed === 'object') {
          parsedMetadata = parsed as Record<string, unknown>;
        }
      } catch {
        parsedMetadata = null;
      }
    }

    return {
      ...row,
      metadata: parsedMetadata,
    };
  }

  /**
   * Request cancellation of a running execution (Phase 47.2)
   *
   * Updates ledger: execution_status = 'cancel_requested'
   * Only applies when current status is 'running'.
   *
   * @returns true if update succeeded, false if execution cannot be cancelled
   */
  async requestCancel(executionId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `
      UPDATE usage_records
      SET execution_status = 'cancel_requested'
      WHERE execution_id = $1
      AND execution_status = 'running'
      RETURNING execution_id
      `,
      [executionId],
    );

    return result.length > 0;
  }

  /**
   * Owner-scoped run list. Selects identity columns and two metadata keys only.
   * state 'active' keeps pending, running, and cancel_requested.
   * state 'recent' applies no status filter. Newest "timestamp" first.
   */
  async listRunsForUser(input: {
    userId: string;
    state: 'active' | 'recent';
    sessionId?: string;
    limit: number;
  }): Promise<ListedRunRow[]> {
    const params: Array<string | number> = [input.userId];
    const filters = ['user_id = $1'];

    if (input.sessionId !== undefined) {
      params.push(input.sessionId);
      filters.push(`session_id = $${params.length}`);
    }

    if (input.state === 'active') {
      filters.push(
        "execution_status IN ('pending', 'running', 'cancel_requested')",
      );
    }

    params.push(input.limit);
    const limitParam = `$${params.length}`;

    const sql = `
      SELECT
        execution_id,
        session_id,
        execution_status,
        provider,
        model,
        tokens_used,
        execution_duration_ms,
        "timestamp",
        metadata->>'runMode' AS "runMode",
        metadata->>'agentId' AS "agentId"
      FROM usage_records
      WHERE ${filters.join(' AND ')}
      ORDER BY "timestamp" DESC
      LIMIT ${limitParam}
    `;

    return this.dataSource.query(sql, params);
  }
}
