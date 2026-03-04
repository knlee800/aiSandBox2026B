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
}
