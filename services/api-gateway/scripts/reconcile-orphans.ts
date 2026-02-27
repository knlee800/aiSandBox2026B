/**
 * Orphan Execution Reconciliation Script
 *
 * PHASE-43B-4: Orphan Execution Cleanup & Reconciliation
 *
 * Purpose:
 * - Identify and transition orphaned 'pending' executions to 'timeout'
 * - Orphan: execution_status='pending' AND timestamp < NOW() - 5 minutes
 * - Admin-only script (manual invocation or external scheduler)
 *
 * Usage:
 *   cd services/api-gateway
 *   npx ts-node scripts/reconcile-orphans.ts
 *
 * Safety:
 * - Idempotent (can run multiple times safely)
 * - Read-only check mode available (--dry-run)
 * - No deletions (only UPDATE)
 * - Preserves audit trail
 *
 * Output:
 * - List of reconciled executions (executionId, userId, requestId, age)
 * - Count of orphans found and transitioned
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

interface OrphanRecord {
  execution_id: string;
  user_id: string;
  request_id: string | null;
  timestamp: Date;
}

async function reconcileOrphans(dryRun: boolean = false) {
  console.log('='.repeat(60));
  console.log('Orphan Execution Reconciliation Script');
  console.log('PHASE-43B-4: Orphan Execution Cleanup & Reconciliation');
  console.log('='.repeat(60));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);

  const ORPHAN_TIMEOUT_MINUTES = 5;

  console.log(`Configuration:`);
  console.log(`  - Orphan timeout: ${ORPHAN_TIMEOUT_MINUTES} minutes`);
  console.log(`  - Dry run mode: ${dryRun ? 'YES (no changes)' : 'NO (will update)'}`);
  console.log('');

  // Step 1: Find orphaned executions
  console.log('Step 1: Finding orphaned executions...');
  const orphans = await dataSource.query<OrphanRecord[]>(
    `SELECT execution_id, user_id, request_id, timestamp
     FROM usage_records
     WHERE execution_status = 'pending'
       AND timestamp < NOW() - INTERVAL '${ORPHAN_TIMEOUT_MINUTES} minutes'
     ORDER BY timestamp ASC`,
  );

  if (orphans.length === 0) {
    console.log('  ✓ No orphaned executions found.');
    console.log('');
    await app.close();
    return;
  }

  console.log(`  ✓ Found ${orphans.length} orphaned execution(s):`);
  console.log('');

  orphans.forEach((row, index) => {
    const age = Math.floor(
      (Date.now() - new Date(row.timestamp).getTime()) / 60000,
    );
    console.log(`  ${index + 1}. executionId: ${row.execution_id}`);
    console.log(`     userId: ${row.user_id}`);
    console.log(`     requestId: ${row.request_id || 'N/A'}`);
    console.log(`     age: ${age} minutes`);
    console.log('');
  });

  if (dryRun) {
    console.log('Dry run mode: No changes made.');
    console.log('');
    await app.close();
    return;
  }

  // Step 2: Transition orphans to 'timeout'
  console.log('Step 2: Transitioning orphans to timeout...');
  const result = await dataSource.query(
    `UPDATE usage_records
     SET execution_status = 'timeout'
     WHERE execution_status = 'pending'
       AND timestamp < NOW() - INTERVAL '${ORPHAN_TIMEOUT_MINUTES} minutes'`,
  );

  const updatedCount = result[1]; // Second element is affected rows count
  console.log(`  ✓ Transitioned ${updatedCount} execution(s) to 'timeout'`);
  console.log('');

  // Step 3: Verify
  console.log('Step 3: Verifying...');
  const remainingOrphans = await dataSource.query<OrphanRecord[]>(
    `SELECT COUNT(*) as count
     FROM usage_records
     WHERE execution_status = 'pending'
       AND timestamp < NOW() - INTERVAL '${ORPHAN_TIMEOUT_MINUTES} minutes'`,
  );

  const remainingCount = remainingOrphans[0]?.count || 0;
  if (remainingCount === 0) {
    console.log('  ✓ No remaining orphaned executions.');
  } else {
    console.log(`  ⚠ Warning: ${remainingCount} orphaned execution(s) still pending.`);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('Reconciliation complete.');
  console.log('='.repeat(60));

  await app.close();
}

// Parse command-line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

reconcileOrphans(dryRun).catch((error) => {
  console.error('');
  console.error('='.repeat(60));
  console.error('ERROR: Reconciliation failed');
  console.error('='.repeat(60));
  console.error('');
  console.error(error);
  console.error('');
  process.exit(1);
});
