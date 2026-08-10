const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const {
  COMPONENTS,
  createInitialState,
  createLogger,
  createResendNotifier,
  createWatchdog,
  evaluateComponentState,
  parseRedisUrl,
  probeHttpEndpoint,
  probeRedisPing,
  runProbeCycle,
  sanitizeErrorMessage,
} = require('../ops-watchdog');

function createMemoryLogger() {
  const lines = [];
  const logger = createLogger({
    log: (line) => lines.push(line),
    warn: (line) => lines.push(line),
    error: (line) => lines.push(line),
  });
  return { logger, lines };
}

function createConfig(overrides = {}) {
  return {
    resendApiKey: 'test_resend_api_key',
    authEmailFrom: 'ops@example.com',
    operatorAlertRecipient: 'operator@example.com',
    redisUrl: 'redis://:password123@127.0.0.1:6379',
    checkIntervalMs: 60_000,
    alertCooldownMs: 30 * 60 * 1000,
    environmentLabel: 'staging.ainow.biz',
    ...overrides,
  };
}

test('healthy probe result resets failures and marks recovery', () => {
  const previous = {
    consecutiveFailures: 4,
    isDegraded: true,
    lastAlertAtMs: 100,
    lastFailureDetail: 'timeout',
  };

  const evaluation = evaluateComponentState(previous, { healthy: true, detail: 'ok' }, 2, 5_000, 1_000);
  assert.equal(evaluation.nextState.consecutiveFailures, 0);
  assert.equal(evaluation.nextState.isDegraded, false);
  assert.equal(evaluation.shouldSendFailureAlert, false);
  assert.equal(evaluation.shouldSendRecoveryAlert, true);
});

test('first failure below threshold does not alert', () => {
  const previous = {
    consecutiveFailures: 0,
    isDegraded: false,
    lastAlertAtMs: Number.NEGATIVE_INFINITY,
    lastFailureDetail: null,
  };

  const evaluation = evaluateComponentState(previous, { healthy: false, detail: 'connection-error' }, 2, 1_000, 10_000);
  assert.equal(evaluation.nextState.consecutiveFailures, 1);
  assert.equal(evaluation.shouldSendFailureAlert, false);
});

test('threshold failure triggers alert at 2 for non-frontend components', () => {
  const previous = {
    consecutiveFailures: 1,
    isDegraded: false,
    lastAlertAtMs: Number.NEGATIVE_INFINITY,
    lastFailureDetail: 'connection-error',
  };

  const evaluation = evaluateComponentState(previous, { healthy: false, detail: 'timeout' }, 2, 10_000, 1_000);
  assert.equal(evaluation.nextState.consecutiveFailures, 2);
  assert.equal(evaluation.shouldSendFailureAlert, true);
  assert.equal(evaluation.nextState.lastAlertAtMs, 10_000);
});

test('frontend requires 3 consecutive failures before alert', () => {
  const secondFailure = evaluateComponentState(
    {
      consecutiveFailures: 1,
      isDegraded: false,
      lastAlertAtMs: Number.NEGATIVE_INFINITY,
      lastFailureDetail: 'http-502',
    },
    { healthy: false, detail: 'http-502' },
    3,
    5_000,
    1_000,
  );
  assert.equal(secondFailure.shouldSendFailureAlert, false);

  const thirdFailure = evaluateComponentState(secondFailure.nextState, { healthy: false, detail: 'http-502' }, 3, 6_000, 1_000);
  assert.equal(thirdFailure.shouldSendFailureAlert, true);
});

test('cooldown suppresses duplicate alerts and allows re-alert after expiry', () => {
  const thresholdHit = evaluateComponentState(
    {
      consecutiveFailures: 1,
      isDegraded: false,
      lastAlertAtMs: Number.NEGATIVE_INFINITY,
      lastFailureDetail: null,
    },
    { healthy: false, detail: 'timeout' },
    2,
    10_000,
    30_000,
  );
  assert.equal(thresholdHit.shouldSendFailureAlert, true);

  const suppressed = evaluateComponentState(
    thresholdHit.nextState,
    { healthy: false, detail: 'timeout' },
    2,
    20_000,
    30_000,
  );
  assert.equal(suppressed.shouldSendFailureAlert, false);

  const afterCooldown = evaluateComponentState(
    suppressed.nextState,
    { healthy: false, detail: 'timeout' },
    2,
    50_500,
    30_000,
  );
  assert.equal(afterCooldown.shouldSendFailureAlert, true);
});

test('component counters and cooldown state are independent', async () => {
  const config = createConfig();
  const { logger } = createMemoryLogger();
  const state = createInitialState(COMPONENTS);
  const sentSubjects = [];

  await runProbeCycle({
    components: COMPONENTS,
    state,
    config,
    logger,
    notifier: async (payload) => sentSubjects.push(payload.subject),
    nowMs: 1_000,
    probeComponent: async (component) => {
      if (component.id === 'api-gateway') {
        return { healthy: false, detail: 'timeout' };
      }
      return { healthy: true, detail: 'ok' };
    },
  });

  await runProbeCycle({
    components: COMPONENTS,
    state,
    config,
    logger,
    notifier: async (payload) => sentSubjects.push(payload.subject),
    nowMs: 2_000,
    probeComponent: async (component) => {
      if (component.id === 'api-gateway') {
        return { healthy: false, detail: 'timeout' };
      }
      return { healthy: true, detail: 'ok' };
    },
  });

  assert.equal(state['api-gateway'].consecutiveFailures, 2);
  assert.equal(state.frontend.consecutiveFailures, 0);
  assert.equal(sentSubjects.length, 1);
  assert.match(sentSubjects[0], /API Gateway/);
});

test('missing OPERATOR_ALERT_RECIPIENT safely suppresses send', async () => {
  let fetchCalled = false;
  const config = createConfig({ operatorAlertRecipient: '' });
  const { logger } = createMemoryLogger();
  const notifier = createResendNotifier({
    config,
    logger,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error('should not run');
    },
  });

  const result = await notifier({
    subject: 'test',
    text: 'test',
    html: '<p>test</p>',
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'missing-recipient');
  assert.equal(fetchCalled, false);
});

test('notification failure does not crash watchdog cycle', async () => {
  const { logger } = createMemoryLogger();
  const config = createConfig();
  let notifierCalls = 0;

  const watchdog = createWatchdog({
    config,
    logger,
    notifier: async () => {
      notifierCalls += 1;
      throw new Error('resend outage');
    },
    nowFn: (() => {
      let now = 0;
      return () => {
        now += 1_000;
        return now;
      };
    })(),
    setTimeoutImpl: () => 0,
    clearTimeoutImpl: () => {},
    fetchImpl: async () => {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      throw error;
    },
    createRedisSocket: () => {
      const socket = new EventEmitter();
      socket.write = () => {};
      socket.end = () => {};
      socket.destroy = () => {};
      setImmediate(() => socket.emit('error', new Error('ECONNREFUSED')));
      return socket;
    },
  });

  await watchdog.runOnce();
  await watchdog.runOnce();

  assert.ok(notifierCalls >= 1, 'watchdog should attempt sending after threshold');
});

test('http probe classifies success response as healthy', async () => {
  const result = await probeHttpEndpoint({
    url: 'http://example.test/health',
    fetchImpl: async () => ({ status: 200, ok: true }),
    successMode: 'status-200',
  });

  assert.equal(result.healthy, true);
  assert.equal(result.detail, 'ok');
});

test('http probe classifies connection errors as unhealthy', async () => {
  const result = await probeHttpEndpoint({
    url: 'http://example.test/health',
    fetchImpl: async () => {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      throw error;
    },
  });

  assert.equal(result.healthy, false);
  assert.equal(result.detail, 'connection-error');
});

test('http probe classifies timeout as unhealthy', async () => {
  const result = await probeHttpEndpoint({
    url: 'http://example.test/health',
    timeoutMs: 20,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  });

  assert.equal(result.healthy, false);
  assert.equal(result.detail, 'timeout');
});

test('redis probe returns healthy on successful PING', async () => {
  const writes = [];
  const result = await probeRedisPing({
    redisUrl: 'redis://127.0.0.1:6379',
    timeoutMs: 100,
    createSocket: () => {
      const socket = new EventEmitter();
      socket.write = (payload) => {
        writes.push(payload);
        if (payload.includes('PING')) {
          setImmediate(() => socket.emit('data', Buffer.from('+PONG\r\n')));
        }
      };
      socket.end = () => {};
      socket.destroy = () => {};
      setImmediate(() => socket.emit('connect'));
      return socket;
    },
  });

  assert.equal(result.healthy, true);
  assert.equal(result.detail, 'ok');
  assert.ok(writes.some((line) => line.includes('PING')));
});

test('redis probe returns unhealthy on connection error', async () => {
  const result = await probeRedisPing({
    redisUrl: 'redis://127.0.0.1:6379',
    timeoutMs: 100,
    createSocket: () => {
      const socket = new EventEmitter();
      socket.write = () => {};
      socket.end = () => {};
      socket.destroy = () => {};
      setImmediate(() => socket.emit('error', new Error('ECONNREFUSED')));
      return socket;
    },
  });

  assert.equal(result.healthy, false);
  assert.equal(result.detail, 'connection-error');
});

test('redis probe returns unhealthy on timeout', async () => {
  const result = await probeRedisPing({
    redisUrl: 'redis://127.0.0.1:6379',
    timeoutMs: 20,
    createSocket: () => {
      const socket = new EventEmitter();
      socket.write = () => {};
      socket.end = () => {};
      socket.destroy = () => {};
      return socket;
    },
  });

  assert.equal(result.healthy, false);
  assert.equal(result.detail, 'timeout');
});

test('redis probe performs AUTH before PING when credentials exist', async () => {
  const writes = [];
  const result = await probeRedisPing({
    redisUrl: 'redis://:password123@127.0.0.1:6379',
    timeoutMs: 100,
    createSocket: () => {
      const socket = new EventEmitter();
      socket.write = (payload) => {
        writes.push(payload);
        if (payload.includes('AUTH')) {
          setImmediate(() => socket.emit('data', Buffer.from('+OK\r\n')));
        }
        if (payload.includes('PING')) {
          setImmediate(() => socket.emit('data', Buffer.from('+PONG\r\n')));
        }
      };
      socket.end = () => {};
      socket.destroy = () => {};
      setImmediate(() => socket.emit('connect'));
      return socket;
    },
  });

  assert.equal(result.healthy, true);
  assert.ok(writes[0].includes('AUTH'));
  assert.ok(writes.some((line) => line.includes('PING')));
});

test('rediss scheme is parsed for TLS mode', () => {
  const parsed = parseRedisUrl('rediss://:secret@redis.local:6380');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.connection.useTls, true);
  assert.equal(parsed.connection.port, 6380);
});

test('secret-bearing values are redacted from diagnostics', async () => {
  const secretApiKey = 'rk_live_very_secret_value';
  const secretRedisUrl = 'redis://:supersecretpass@127.0.0.1:6379';
  const raw = `failure Bearer ${secretApiKey} ${secretRedisUrl} password=supersecretpass`;
  const safe = sanitizeErrorMessage(raw, [secretApiKey, secretRedisUrl, 'supersecretpass']);
  assert.equal(safe.includes(secretApiKey), false);
  assert.equal(safe.includes(secretRedisUrl), false);
  assert.equal(safe.includes('supersecretpass'), false);

  const config = createConfig({
    resendApiKey: secretApiKey,
    redisUrl: secretRedisUrl,
  });
  const { logger, lines } = createMemoryLogger();
  const notifier = createResendNotifier({
    config,
    logger,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => `Bearer ${secretApiKey} ${secretRedisUrl}`,
    }),
  });

  await notifier({ subject: 'alert', text: 'x', html: '<p>x</p>' });

  const logged = lines.join('\n');
  assert.equal(logged.includes(secretApiKey), false);
  assert.equal(logged.includes(secretRedisUrl), false);
});
