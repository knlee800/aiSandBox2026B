import { Injectable, Logger } from '@nestjs/common';

/**
 * Operator Audit Logging Service
 *
 * Append-only audit log for operational actions:
 * - Kill switch changes
 * - Safety limit changes
 * - Emergency overrides
 * - Abort mode changes (Phase 28B-2)
 * - Launch state rollbacks (Phase 28B-2)
 *
 * Phase 26B: Production Readiness
 * Phase 28B-2: Abort & Rollback Controls
 */

export interface AuditLogEntry {
  timestamp: Date;
  actor: string; // Who performed action
  action: string; // What action (e.g., 'kill_switch_changed')
  resource: string; // Which resource (e.g., 'GLOBAL_EXECUTION_ENABLED')
  oldValue?: string; // Old value (if applicable)
  newValue?: string; // New value (if applicable)
  reason?: string; // Why action performed
  incidentId?: string; // Related incident ID (if applicable)
  ipAddress?: string; // Source IP
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  // In-memory audit log (Phase 26B MVP)
  // Future: Persist to database or external audit system
  private auditLog: AuditLogEntry[] = [];

  /**
   * Log kill switch change
   */
  logKillSwitchChange(
    actor: string,
    switchName: string,
    oldValue: boolean,
    newValue: boolean,
    reason?: string,
    incidentId?: string,
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      actor,
      action: 'kill_switch_changed',
      resource: switchName,
      oldValue: String(oldValue),
      newValue: String(newValue),
      reason,
      incidentId,
    };

    this.auditLog.push(entry);

    // Also log to structured logger
    this.logger.warn('Kill switch changed', {
      actor,
      switchName,
      oldValue,
      newValue,
      reason,
      incidentId,
    });
  }

  /**
   * Log safety limit change
   */
  logSafetyLimitChange(
    actor: string,
    limitName: string,
    oldValue: number,
    newValue: number,
    reason?: string,
    incidentId?: string,
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      actor,
      action: 'safety_limit_changed',
      resource: limitName,
      oldValue: String(oldValue),
      newValue: String(newValue),
      reason,
      incidentId,
    };

    this.auditLog.push(entry);

    // Also log to structured logger
    this.logger.warn('Safety limit changed', {
      actor,
      limitName,
      oldValue,
      newValue,
      reason,
      incidentId,
    });
  }

  /**
   * Log emergency override
   */
  logEmergencyOverride(
    actor: string,
    action: string,
    resource: string,
    reason: string,
    incidentId?: string,
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      actor,
      action,
      resource,
      reason,
      incidentId,
    };

    this.auditLog.push(entry);

    // Also log to structured logger
    this.logger.error('Emergency override executed', {
      actor,
      action,
      resource,
      reason,
      incidentId,
    });
  }

  /**
   * Log abort mode change
   *
   * Phase 28B-2: Abort & Rollback Controls
   */
  logAbortModeChange(
    actor: string,
    oldMode: string,
    newMode: string,
    reason?: string,
    incidentId?: string,
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      actor,
      action: 'abort_mode_changed',
      resource: 'ABORT_MODE',
      oldValue: oldMode,
      newValue: newMode,
      reason,
      incidentId,
    };

    this.auditLog.push(entry);

    // Also log to structured logger
    this.logger.error('Abort mode changed', {
      actor,
      oldMode,
      newMode,
      reason,
      incidentId,
    });
  }

  /**
   * Log launch state rollback
   *
   * Phase 28B-2: Abort & Rollback Controls
   */
  logLaunchStateRollback(
    actor: string,
    previousState: string,
    newState: string,
    reason?: string,
    incidentId?: string,
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      actor,
      action: 'launch_state_rollback',
      resource: 'LAUNCH_STATE',
      oldValue: previousState,
      newValue: newState,
      reason,
      incidentId,
    };

    this.auditLog.push(entry);

    // Also log to structured logger
    this.logger.warn('Launch state rollback', {
      actor,
      previousState,
      newState,
      reason,
      incidentId,
    });
  }

  /**
   * Get audit log entries (for observability)
   */
  getAuditLog(limit?: number): AuditLogEntry[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return [...this.auditLog];
  }

  /**
   * Get audit log count
   */
  getAuditLogCount(): number {
    return this.auditLog.length;
  }
}
