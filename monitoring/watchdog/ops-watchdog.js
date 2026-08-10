const net = require('node:net');
const tls = require('node:tls');

const DEFAULT_HTTP_TIMEOUT_MS = 8_000;
const DEFAULT_REDIS_TIMEOUT_MS = 5_000;
const DEFAULT_CHECK_INTERVAL_MS = 60_000;
const DEFAULT_ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const RESEND_API_URL = 'https://api.resend.com/emails';
const WATCHDOG_USER_AGENT = 'aiSandBox-ops-watchdog/1.0';

const COMPONENTS = Object.freeze([
  {
    id: 'api-gateway',
    label: 'API Gateway',
    threshold: 2,
    probe: {
      type: 'http',
      url: 'http://127.0.0.1:4000/api/health/ready',
      successMode: 'status-200',
      timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
    },
    runbookHint: 'Check API Gateway readiness logs and DB readiness.',
  },
  {
    id: 'ai-service',
    label: 'AI Service',
    threshold: 2,
    probe: {
      type: 'http',
      url: 'http://127.0.0.1:4001/metrics',
      successMode: 'status-200',
      timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
    },
    runbookHint: 'Check ai-service process health and worker logs.',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    threshold: 3,
    probe: {
      type: 'http',
      url: 'https://staging.ainow.biz',
      successMode: '2xx-or-3xx',
      timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
    },
    runbookHint: 'Check DNS/TLS/Caddy and frontend process status.',
  },
  {
    id: 'container-manager',
    label: 'Container Manager',
    threshold: 2,
    probe: {
      type: 'http',
      url: 'http://127.0.0.1:4002/api/health',
      successMode: 'status-200',
      timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
    },
    runbookHint: 'Check container-manager process and Docker connectivity.',
  },
  {
    id: 'redis',
    label: 'Redis',
    threshold: 2,
    probe: {
      type: 'redis',
      timeoutMs: DEFAULT_REDIS_TIMEOUT_MS,
    },
    runbookHint: 'Check Redis availability and auth configuration.',
  },
]);

function createInitialState(components = COMPONENTS) {
  const state = {};
  for (const component of components) {
    state[component.id] = {
      consecutiveFailures: 0,
      isDegraded: false,
      lastAlertAtMs: Number.NEGATIVE_INFINITY,
      lastFailureDetail: null,
    };
  }
  return state;
}

function sanitizeErrorMessage(raw, secretValues = []) {
  let value = String(raw ?? 'unknown-error');

  value = value.replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]');
  value = value.replace(/([a-z]+:\/\/)([^@/\s]+)@/gi, '$1[REDACTED]@');
  value = value.replace(/(password=)[^&\s]+/gi, '$1[REDACTED]');
  value = value.replace(/(api[_-]?key=)[^&\s]+/gi, '$1[REDACTED]');

  for (const secret of secretValues) {
    if (typeof secret === 'string' && secret.length >= 4) {
      value = value.split(secret).join('[REDACTED]');
    }
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function createLogger(consoleLike = console) {
  function write(level, event, fields = {}) {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...fields,
    });

    if (level === 'error') {
      consoleLike.error(line);
      return;
    }
    if (level === 'warn') {
      consoleLike.warn(line);
      return;
    }
    consoleLike.log(line);
  }

  return {
    info(event, fields) {
      write('info', event, fields);
    },
    warn(event, fields) {
      write('warn', event, fields);
    },
    error(event, fields) {
      write('error', event, fields);
    },
  };
}

function loadConfig(env = process.env) {
  return {
    resendApiKey: env.RESEND_API_KEY || '',
    authEmailFrom: env.AUTH_EMAIL_FROM || '',
    operatorAlertRecipient: env.OPERATOR_ALERT_RECIPIENT || '',
    redisUrl: env.REDIS_URL || '',
    checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
    alertCooldownMs: DEFAULT_ALERT_COOLDOWN_MS,
    environmentLabel: 'staging.ainow.biz',
  };
}

function validateStartupConfig(config, logger) {
  if (!config.operatorAlertRecipient) {
    logger.warn('watchdog_missing_operator_recipient', {
      message: 'OPERATOR_ALERT_RECIPIENT missing; alerts are suppressed.',
    });
  }

  if (config.operatorAlertRecipient && !config.resendApiKey) {
    logger.warn('watchdog_missing_resend_api_key', {
      message: 'RESEND_API_KEY missing; alerts are suppressed.',
    });
  }

  if (config.operatorAlertRecipient && !config.authEmailFrom) {
    logger.warn('watchdog_missing_auth_email_from', {
      message: 'AUTH_EMAIL_FROM missing; alerts are suppressed.',
    });
  }

  if (!config.redisUrl) {
    logger.warn('watchdog_missing_redis_url', {
      message: 'REDIS_URL missing; Redis probe will report unhealthy.',
    });
  }
}

function evaluateComponentState(previous, probeResult, threshold, nowMs, cooldownMs) {
  if (probeResult.healthy) {
    const shouldSendRecovery = previous.isDegraded;
    return {
      nextState: {
        consecutiveFailures: 0,
        isDegraded: false,
        lastAlertAtMs: previous.lastAlertAtMs,
        lastFailureDetail: null,
      },
      shouldSendFailureAlert: false,
      shouldSendRecoveryAlert: shouldSendRecovery,
    };
  }

  const consecutiveFailures = previous.consecutiveFailures + 1;
  const crossedThreshold = consecutiveFailures >= threshold;
  const cooldownElapsed = nowMs - previous.lastAlertAtMs >= cooldownMs;
  const shouldSendFailureAlert = crossedThreshold && cooldownElapsed;

  return {
    nextState: {
      consecutiveFailures,
      isDegraded: previous.isDegraded || crossedThreshold,
      lastAlertAtMs: shouldSendFailureAlert ? nowMs : previous.lastAlertAtMs,
      lastFailureDetail: probeResult.detail || 'probe-failed',
    },
    shouldSendFailureAlert,
    shouldSendRecoveryAlert: false,
  };
}

async function probeHttpEndpoint({
  url,
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
  successMode = 'status-200',
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') {
    return { healthy: false, detail: 'fetch-unavailable' };
  }

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: abortController.signal,
      headers: {
        'user-agent': WATCHDOG_USER_AGENT,
      },
    });

    const status = Number(response.status);
    const healthyBy200 = successMode === 'status-200' && status === 200;
    const healthyBy2xxOr3xx =
      successMode === '2xx-or-3xx' && ((status >= 200 && status < 300) || (status >= 300 && status < 400));

    if (healthyBy200 || healthyBy2xxOr3xx) {
      return { healthy: true, detail: 'ok', status };
    }

    return { healthy: false, detail: `http-${status}`, status };
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
    if (error?.name === 'AbortError') {
      return { healthy: false, detail: 'timeout' };
    }
    if (code === 'econnrefused' || code === 'enotfound' || code === 'econnreset') {
      return { healthy: false, detail: 'connection-error' };
    }
    return { healthy: false, detail: 'network-error' };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function encodeRedisCommand(parts) {
  const chunks = [`*${parts.length}\r\n`];
  for (const part of parts) {
    const text = String(part);
    chunks.push(`$${Buffer.byteLength(text)}\r\n${text}\r\n`);
  }
  return chunks.join('');
}

function parseRedisUrl(redisUrl) {
  if (!redisUrl) {
    return { ok: false, error: 'missing-redis-url' };
  }

  let parsed;
  try {
    parsed = new URL(redisUrl);
  } catch (_error) {
    return { ok: false, error: 'invalid-redis-url' };
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    return { ok: false, error: 'unsupported-redis-url-scheme' };
  }

  const port = parsed.port ? Number(parsed.port) : 6379;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { ok: false, error: 'invalid-redis-port' };
  }

  const username = decodeURIComponent(parsed.username || '');
  const password = decodeURIComponent(parsed.password || '');

  return {
    ok: true,
    connection: {
      host: parsed.hostname || '127.0.0.1',
      port,
      useTls: parsed.protocol === 'rediss:',
      username,
      password,
      requiresAuth: Boolean(username || password),
    },
  };
}

function defaultCreateRedisSocket(connection) {
  const baseOptions = {
    host: connection.host,
    port: connection.port,
  };

  if (connection.useTls) {
    return tls.connect({
      ...baseOptions,
      servername: connection.host,
      rejectUnauthorized: true,
    });
  }

  return net.createConnection(baseOptions);
}

async function probeRedisPing({
  redisUrl,
  timeoutMs = DEFAULT_REDIS_TIMEOUT_MS,
  createSocket = defaultCreateRedisSocket,
}) {
  const parsed = parseRedisUrl(redisUrl);
  if (!parsed.ok) {
    return { healthy: false, detail: parsed.error };
  }

  return new Promise((resolve) => {
    let settled = false;
    let stage = parsed.connection.requiresAuth ? 'auth' : 'ping';
    let buffer = '';

    const socket = createSocket(parsed.connection);
    const timeoutHandle = setTimeout(() => finish(false, 'timeout'), timeoutMs);

    function cleanup() {
      clearTimeout(timeoutHandle);
      socket.removeAllListeners('connect');
      socket.removeAllListeners('data');
      socket.removeAllListeners('error');
      socket.removeAllListeners('end');
      socket.removeAllListeners('close');
    }

    function closeSocket() {
      try {
        socket.end();
      } catch (_error) {
        // Ignore close errors during shutdown.
      }
      try {
        socket.destroy();
      } catch (_error) {
        // Ignore close errors during shutdown.
      }
    }

    function finish(healthy, detail) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      closeSocket();
      resolve({ healthy, detail });
    }

    function sendCommand(parts) {
      try {
        socket.write(encodeRedisCommand(parts));
      } catch (_error) {
        finish(false, 'socket-write-failed');
      }
    }

    socket.on('connect', () => {
      if (parsed.connection.requiresAuth) {
        if (parsed.connection.username) {
          sendCommand(['AUTH', parsed.connection.username, parsed.connection.password]);
        } else {
          sendCommand(['AUTH', parsed.connection.password]);
        }
        return;
      }
      sendCommand(['PING']);
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      while (buffer.includes('\r\n')) {
        const lineEnd = buffer.indexOf('\r\n');
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);

        if (stage === 'auth') {
          if (line.startsWith('+OK')) {
            stage = 'ping';
            sendCommand(['PING']);
            continue;
          }
          if (line.startsWith('-')) {
            finish(false, 'auth-failed');
            return;
          }
          continue;
        }

        if (stage === 'ping') {
          if (line.startsWith('+PONG')) {
            finish(true, 'ok');
            return;
          }
          if (line.startsWith('-')) {
            finish(false, 'ping-failed');
            return;
          }
          if (line.startsWith('+')) {
            finish(false, 'unexpected-response');
            return;
          }
        }
      }
    });

    socket.on('error', () => finish(false, 'connection-error'));
    socket.on('end', () => finish(false, 'connection-closed'));
    socket.on('close', () => {
      if (!settled) {
        finish(false, 'connection-closed');
      }
    });
  });
}

function buildFailureAlert(component, probeResult, state, config, timestampIso) {
  return {
    subject: `[aiSandBox ALERT] ${component.label} unhealthy`,
    text: [
      `Environment: ${config.environmentLabel}`,
      `Component: ${component.label}`,
      `Condition: ${probeResult.detail}`,
      `Timestamp: ${timestampIso}`,
      `Consecutive failures: ${state.consecutiveFailures}`,
      `Hint: ${component.runbookHint}`,
    ].join('\n'),
    html: [
      `<p><strong>Environment:</strong> ${escapeHtml(config.environmentLabel)}</p>`,
      `<p><strong>Component:</strong> ${escapeHtml(component.label)}</p>`,
      `<p><strong>Condition:</strong> ${escapeHtml(probeResult.detail)}</p>`,
      `<p><strong>Timestamp:</strong> ${escapeHtml(timestampIso)}</p>`,
      `<p><strong>Consecutive failures:</strong> ${state.consecutiveFailures}</p>`,
      `<p><strong>Hint:</strong> ${escapeHtml(component.runbookHint)}</p>`,
    ].join(''),
  };
}

function buildRecoveryAlert(component, config, timestampIso) {
  return {
    subject: `[aiSandBox RECOVERY] ${component.label} recovered`,
    text: [
      `Environment: ${config.environmentLabel}`,
      `Component: ${component.label}`,
      'Condition: recovered',
      `Timestamp: ${timestampIso}`,
      `Hint: ${component.runbookHint}`,
    ].join('\n'),
    html: [
      `<p><strong>Environment:</strong> ${escapeHtml(config.environmentLabel)}</p>`,
      `<p><strong>Component:</strong> ${escapeHtml(component.label)}</p>`,
      '<p><strong>Condition:</strong> recovered</p>',
      `<p><strong>Timestamp:</strong> ${escapeHtml(timestampIso)}</p>`,
      `<p><strong>Hint:</strong> ${escapeHtml(component.runbookHint)}</p>`,
    ].join(''),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createResendNotifier({ config, fetchImpl = globalThis.fetch, logger }) {
  const secretValues = [config.resendApiKey, config.redisUrl];

  return async function sendNotification({ subject, text, html }) {
    if (!config.operatorAlertRecipient) {
      logger.info('watchdog_alert_suppressed_missing_recipient', { subject });
      return { delivered: false, skipped: true, reason: 'missing-recipient' };
    }

    if (!config.resendApiKey || !config.authEmailFrom) {
      logger.warn('watchdog_alert_suppressed_missing_sender_config', { subject });
      return { delivered: false, skipped: true, reason: 'missing-sender-config' };
    }

    try {
      const response = await fetchImpl(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': WATCHDOG_USER_AGENT,
        },
        body: JSON.stringify({
          from: config.authEmailFrom,
          to: [config.operatorAlertRecipient],
          subject,
          text,
          html,
        }),
      });

      if (!response.ok) {
        const body = typeof response.text === 'function' ? await response.text() : '';
        const safeBody = sanitizeErrorMessage(body, secretValues);
        logger.error('watchdog_resend_non_2xx', {
          status: response.status,
          detail: safeBody || 'resend-non-2xx',
        });
        return { delivered: false, skipped: false, reason: 'resend-non-2xx' };
      }

      logger.info('watchdog_alert_delivered', { subject });
      return { delivered: true, skipped: false };
    } catch (error) {
      logger.error('watchdog_resend_error', {
        detail: sanitizeErrorMessage(error?.message || 'resend-error', secretValues),
      });
      return { delivered: false, skipped: false, reason: 'resend-request-failed' };
    }
  };
}

async function defaultProbeComponent(component, { fetchImpl, config, createRedisSocket }) {
  if (component.probe.type === 'http') {
    return probeHttpEndpoint({
      url: component.probe.url,
      timeoutMs: component.probe.timeoutMs,
      successMode: component.probe.successMode,
      fetchImpl,
    });
  }

  return probeRedisPing({
    redisUrl: config.redisUrl,
    timeoutMs: component.probe.timeoutMs,
    createSocket: createRedisSocket,
  });
}

async function runProbeCycle({
  components = COMPONENTS,
  state,
  config,
  logger,
  notifier,
  nowMs = Date.now(),
  fetchImpl = globalThis.fetch,
  createRedisSocket = defaultCreateRedisSocket,
  probeComponent = defaultProbeComponent,
}) {
  for (const component of components) {
    const previous = state[component.id];
    let probeResult;

    try {
      probeResult = await probeComponent(component, { fetchImpl, config, createRedisSocket });
    } catch (error) {
      probeResult = {
        healthy: false,
        detail: sanitizeErrorMessage(error?.message || 'probe-exception', [config.redisUrl]),
      };
    }

    const evaluation = evaluateComponentState(
      previous,
      probeResult,
      component.threshold,
      nowMs,
      config.alertCooldownMs,
    );
    state[component.id] = evaluation.nextState;

    logger.info('watchdog_probe_result', {
      component: component.id,
      healthy: probeResult.healthy,
      detail: probeResult.detail,
      consecutiveFailures: state[component.id].consecutiveFailures,
    });

    if (evaluation.shouldSendFailureAlert) {
      const timestampIso = new Date(nowMs).toISOString();
      const alertPayload = buildFailureAlert(component, probeResult, state[component.id], config, timestampIso);
      try {
        await notifier(alertPayload);
      } catch (_error) {
        logger.error('watchdog_notifier_throw_on_failure_alert', {
          component: component.id,
        });
      }
    }

    if (evaluation.shouldSendRecoveryAlert) {
      const timestampIso = new Date(nowMs).toISOString();
      const alertPayload = buildRecoveryAlert(component, config, timestampIso);
      try {
        await notifier(alertPayload);
      } catch (_error) {
        logger.error('watchdog_notifier_throw_on_recovery_alert', {
          component: component.id,
        });
      }
    }
  }
}

function createWatchdog({
  config = loadConfig(),
  components = COMPONENTS,
  logger = createLogger(console),
  notifier = createResendNotifier({ config, logger }),
  fetchImpl = globalThis.fetch,
  createRedisSocket = defaultCreateRedisSocket,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  nowFn = () => Date.now(),
} = {}) {
  const state = createInitialState(components);
  let started = false;
  let stopped = false;
  let timer = null;
  let running = false;

  async function runOnce() {
    if (running) {
      logger.warn('watchdog_cycle_overlap_prevented');
      return;
    }

    running = true;
    try {
      await runProbeCycle({
        components,
        state,
        config,
        logger,
        notifier,
        nowMs: nowFn(),
        fetchImpl,
        createRedisSocket,
      });
    } catch (error) {
      logger.error('watchdog_cycle_error', {
        detail: sanitizeErrorMessage(error?.message || 'cycle-error', [config.redisUrl]),
      });
    } finally {
      running = false;
    }
  }

  function scheduleNextRun() {
    if (stopped) {
      return;
    }

    timer = setTimeoutImpl(async () => {
      await runOnce();
      scheduleNextRun();
    }, config.checkIntervalMs);
  }

  function start() {
    if (started) {
      return;
    }

    started = true;
    stopped = false;
    void runOnce().finally(() => {
      scheduleNextRun();
    });
  }

  function stop() {
    stopped = true;
    started = false;
    if (timer) {
      clearTimeoutImpl(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
    runOnce,
    getState() {
      return JSON.parse(JSON.stringify(state));
    },
  };
}

function startWatchdogProcess() {
  const logger = createLogger(console);
  const config = loadConfig(process.env);
  validateStartupConfig(config, logger);

  const watchdog = createWatchdog({
    config,
    logger,
    notifier: createResendNotifier({ config, logger }),
  });

  const shutdown = (signal) => {
    logger.info('watchdog_shutdown_requested', { signal });
    watchdog.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  logger.info('watchdog_started', {
    componentCount: COMPONENTS.length,
    checkIntervalMs: config.checkIntervalMs,
    alertCooldownMs: config.alertCooldownMs,
  });
  watchdog.start();
}

module.exports = {
  COMPONENTS,
  DEFAULT_ALERT_COOLDOWN_MS,
  DEFAULT_CHECK_INTERVAL_MS,
  DEFAULT_HTTP_TIMEOUT_MS,
  DEFAULT_REDIS_TIMEOUT_MS,
  buildFailureAlert,
  buildRecoveryAlert,
  createInitialState,
  createLogger,
  createResendNotifier,
  createWatchdog,
  defaultCreateRedisSocket,
  evaluateComponentState,
  loadConfig,
  parseRedisUrl,
  probeHttpEndpoint,
  probeRedisPing,
  runProbeCycle,
  sanitizeErrorMessage,
  startWatchdogProcess,
  validateStartupConfig,
};

if (require.main === module) {
  startWatchdogProcess();
}
