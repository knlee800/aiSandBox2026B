import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ExecutionResultService {
  constructor(private readonly dataSource: DataSource) {}

  async getExecution(executionId: string) {
    const result = await this.dataSource.query(
      `
      SELECT
        execution_id,
        execution_status,
        tokens_used
      FROM usage_records
      WHERE execution_id = $1
      `,
      [executionId],
    );

    return result[0] ?? null;
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
}
