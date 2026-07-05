import { InMemoryHarnessAuditRecorder } from './harness-audit-recorder';
import type { HarnessAuditEvent, HarnessLoopStartedEvent } from './harness-audit-events';

function makeEvent(overrides?: Partial<HarnessLoopStartedEvent>): HarnessLoopStartedEvent {
  return {
    eventType: 'harness.loop_started',
    timestamp: Date.now(),
    executionId: 'exec-1',
    sessionId: 'sess-1',
    harnessVersion: 'v1',
    maxToolIterations: 3,
    maxToolResultBytes: 262_144,
    toolTimeoutMs: 30_000,
    ...overrides,
  };
}

describe('InMemoryHarnessAuditRecorder', () => {
  it('starts with no events', () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    expect(recorder.getEvents()).toEqual([]);
  });

  it('accumulates recorded events in order', () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const e1 = makeEvent({ executionId: 'exec-1' });
    const e2 = makeEvent({ executionId: 'exec-2' });

    recorder.record(e1);
    recorder.record(e2);

    const events = recorder.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].executionId).toBe('exec-1');
    expect(events[1].executionId).toBe('exec-2');
  });

  it('getEvents returns current snapshot including later additions', () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    recorder.record(makeEvent());

    expect(recorder.getEvents()).toHaveLength(1);

    recorder.record(makeEvent({ executionId: 'exec-3' }));

    expect(recorder.getEvents()).toHaveLength(2);
  });

  it('recorded event preserves all base fields', () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const ts = Date.now();
    const event = makeEvent({
      timestamp: ts,
      executionId: 'exec-shape',
      sessionId: 'sess-shape',
      harnessVersion: 'v1',
    });

    recorder.record(event);

    const stored = recorder.getEvents()[0];
    expect(stored.eventType).toBe('harness.loop_started');
    expect(stored.timestamp).toBe(ts);
    expect(stored.executionId).toBe('exec-shape');
    expect(stored.sessionId).toBe('sess-shape');
    expect(stored.harnessVersion).toBe('v1');
  });

  it('supports multiple event types in sequence', () => {
    const recorder = new InMemoryHarnessAuditRecorder();

    const loopStarted: HarnessAuditEvent = makeEvent();
    const modelStarted: HarnessAuditEvent = {
      eventType: 'harness.model_invocation_started',
      timestamp: Date.now(),
      executionId: 'exec-1',
      sessionId: 'sess-1',
      harnessVersion: 'v1',
      iteration: 0,
    };

    recorder.record(loopStarted);
    recorder.record(modelStarted);

    const events = recorder.getEvents();
    expect(events[0].eventType).toBe('harness.loop_started');
    expect(events[1].eventType).toBe('harness.model_invocation_started');
  });
});
