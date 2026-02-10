/**
 * Audit Log Tests for Abort and Rollback
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Tests audit logging for abort mode changes and rollback events.
 */

import { AuditLogService } from '../../safety/audit-log.service';

describe('AuditLogService - Abort and Rollback', () => {
  let service: AuditLogService;

  beforeEach(() => {
    service = new AuditLogService();
  });

  describe('Abort mode logging', () => {
    it('should log abort mode change', () => {
      service.logAbortModeChange(
        'operator-123',
        'NONE',
        'EXECUTION_BLOCKED',
        'Provider outage detected',
        'incident-456',
      );

      const logs = service.getAuditLog();
      expect(logs).toHaveLength(1);

      const entry = logs[0];
      expect(entry.actor).toBe('operator-123');
      expect(entry.action).toBe('abort_mode_changed');
      expect(entry.resource).toBe('ABORT_MODE');
      expect(entry.oldValue).toBe('NONE');
      expect(entry.newValue).toBe('EXECUTION_BLOCKED');
      expect(entry.reason).toBe('Provider outage detected');
      expect(entry.incidentId).toBe('incident-456');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should log abort mode change without incident ID', () => {
      service.logAbortModeChange(
        'operator-123',
        'NONE',
        'FULL_SHUTDOWN',
        'Emergency shutdown',
      );

      const logs = service.getAuditLog();
      expect(logs).toHaveLength(1);

      const entry = logs[0];
      expect(entry.incidentId).toBeUndefined();
    });

    it('should log multiple abort mode changes', () => {
      service.logAbortModeChange('operator-1', 'NONE', 'EXECUTION_BLOCKED');
      service.logAbortModeChange('operator-2', 'EXECUTION_BLOCKED', 'FULL_SHUTDOWN');
      service.logAbortModeChange('operator-3', 'FULL_SHUTDOWN', 'NONE');

      const logs = service.getAuditLog();
      expect(logs).toHaveLength(3);
      expect(logs[0].oldValue).toBe('NONE');
      expect(logs[1].oldValue).toBe('EXECUTION_BLOCKED');
      expect(logs[2].oldValue).toBe('FULL_SHUTDOWN');
    });
  });

  describe('Rollback logging', () => {
    it('should log launch state rollback', () => {
      service.logLaunchStateRollback(
        'operator-789',
        'PUBLIC',
        'CLOSED',
        'Cost runaway detected',
        'incident-999',
      );

      const logs = service.getAuditLog();
      expect(logs).toHaveLength(1);

      const entry = logs[0];
      expect(entry.actor).toBe('operator-789');
      expect(entry.action).toBe('launch_state_rollback');
      expect(entry.resource).toBe('LAUNCH_STATE');
      expect(entry.oldValue).toBe('PUBLIC');
      expect(entry.newValue).toBe('CLOSED');
      expect(entry.reason).toBe('Cost runaway detected');
      expect(entry.incidentId).toBe('incident-999');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should log rollback without reason or incident', () => {
      service.logLaunchStateRollback(
        'system-startup',
        'PUBLIC',
        'EARLY_ACCESS',
      );

      const logs = service.getAuditLog();
      expect(logs).toHaveLength(1);

      const entry = logs[0];
      expect(entry.reason).toBeUndefined();
      expect(entry.incidentId).toBeUndefined();
    });

    it('should log multiple rollbacks', () => {
      service.logLaunchStateRollback('operator-1', 'PUBLIC', 'EARLY_ACCESS');
      service.logLaunchStateRollback('operator-2', 'EARLY_ACCESS', 'INTERNAL');
      service.logLaunchStateRollback('operator-3', 'INTERNAL', 'CLOSED');

      const logs = service.getAuditLog();
      expect(logs).toHaveLength(3);
      expect(logs[0].oldValue).toBe('PUBLIC');
      expect(logs[1].oldValue).toBe('EARLY_ACCESS');
      expect(logs[2].oldValue).toBe('INTERNAL');
    });
  });

  describe('Mixed logging', () => {
    it('should log both abort and rollback events', () => {
      service.logAbortModeChange('operator-1', 'NONE', 'EXECUTION_BLOCKED');
      service.logLaunchStateRollback('operator-2', 'PUBLIC', 'CLOSED');
      service.logAbortModeChange('operator-3', 'EXECUTION_BLOCKED', 'FULL_SHUTDOWN');

      const logs = service.getAuditLog();
      expect(logs).toHaveLength(3);
      expect(logs[0].action).toBe('abort_mode_changed');
      expect(logs[1].action).toBe('launch_state_rollback');
      expect(logs[2].action).toBe('abort_mode_changed');
    });

    it('should maintain chronological order', () => {
      const time1 = Date.now();
      service.logAbortModeChange('operator-1', 'NONE', 'EXECUTION_BLOCKED');

      const time2 = Date.now();
      service.logLaunchStateRollback('operator-2', 'PUBLIC', 'CLOSED');

      const logs = service.getAuditLog();
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(time1);
      expect(logs[1].timestamp.getTime()).toBeGreaterThanOrEqual(time2);
      expect(logs[1].timestamp.getTime()).toBeGreaterThanOrEqual(
        logs[0].timestamp.getTime(),
      );
    });
  });

  describe('Audit log retrieval', () => {
    beforeEach(() => {
      // Add multiple log entries
      service.logAbortModeChange('op-1', 'NONE', 'EXECUTION_BLOCKED');
      service.logLaunchStateRollback('op-2', 'PUBLIC', 'CLOSED');
      service.logAbortModeChange('op-3', 'EXECUTION_BLOCKED', 'NONE');
    });

    it('should retrieve all logs', () => {
      const logs = service.getAuditLog();
      expect(logs).toHaveLength(3);
    });

    it('should retrieve limited logs', () => {
      const logs = service.getAuditLog(2);
      expect(logs).toHaveLength(2);
      expect(logs[0].actor).toBe('op-2'); // Most recent 2
      expect(logs[1].actor).toBe('op-3');
    });

    it('should return correct audit log count', () => {
      expect(service.getAuditLogCount()).toBe(3);
    });

    it('should not mutate original log', () => {
      const logs1 = service.getAuditLog();
      logs1.push({
        timestamp: new Date(),
        actor: 'hacker',
        action: 'malicious',
        resource: 'test',
      });

      const logs2 = service.getAuditLog();
      expect(logs2).toHaveLength(3); // Original count unchanged
    });
  });

  describe('Append-only guarantee', () => {
    it('should not allow log deletion', () => {
      service.logAbortModeChange('operator-1', 'NONE', 'EXECUTION_BLOCKED');
      service.logLaunchStateRollback('operator-2', 'PUBLIC', 'CLOSED');

      const logs = service.getAuditLog();
      expect(logs).toHaveLength(2);

      // Try to delete entries (should not affect service)
      logs.splice(0, 1);

      // Original logs should be intact
      const logsAgain = service.getAuditLog();
      expect(logsAgain).toHaveLength(2);
    });

    it('should always append new entries', () => {
      for (let i = 0; i < 10; i++) {
        service.logAbortModeChange(`operator-${i}`, 'NONE', 'EXECUTION_BLOCKED');
      }

      expect(service.getAuditLogCount()).toBe(10);

      // Each entry should be unique
      const logs = service.getAuditLog();
      const actors = logs.map((log) => log.actor);
      expect(new Set(actors).size).toBe(10); // All unique
    });
  });
});
