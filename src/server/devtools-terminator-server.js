'use strict';

var crypto = require('crypto');

var DEFAULT_SECRET = 'change-this-to-a-random-secret';
var STALE_THRESHOLD = 45000;
var REPLAY_WINDOW = 10000;
var CLEANUP_INTERVAL = 60000;
var DEFAULT_RATE_LIMIT_WINDOW = 60000;
var DEFAULT_RATE_LIMIT_HEARTBEAT = 60;
var DEFAULT_RATE_LIMIT_TERMINATE = 10;
var DEFAULT_RATE_LIMIT_SESSION = 30;
var DEFAULT_MAX_BODY_SIZE = 10240;
var DEFAULT_LOG_LEVEL = 'info';

var LOG_LEVEL_MAP = { error: 0, warn: 1, info: 2, debug: 3 };

var sessions = {};
var terminatedSessions = {};
var cleanupTimer = null;
var config = null;
var logger = null;

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function createRateLimiter(windowMs, maxHits) {
  var buckets = {};
  return function (key) {
    var now = Date.now();
    var bucket = buckets[key];
    if (!bucket || now >= bucket.resetAt) {
      buckets[key] = { count: 1, resetAt: now + windowMs };
      return null;
    }
    bucket.count++;
    return bucket.count > maxHits ? bucket.resetAt : null;
  };
}

function createLogger(cfg) {
  var levelNum = LOG_LEVEL_MAP[cfg.logLevel];
  if (levelNum === undefined) levelNum = 2;
  var customLogger = cfg.logger;

  function log(level, levelVal, msg, data) {
    if (levelVal > levelNum) return;
    var entry = {
      time: new Date().toISOString(),
      level: level,
      msg: msg,
      module: 'devtools-terminator'
    };
    if (data) {
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
          entry[key] = data[key];
        }
      }
    }
    if (customLogger) {
      customLogger(entry);
    } else {
      var str = JSON.stringify(entry);
      if (level === 'error' || level === 'warn') {
        process.stderr.write(str + '\n');
      } else {
        process.stdout.write(str + '\n');
      }
    }
  }

  return {
    error: function (msg, data) { log('error', 0, msg, data); },
    warn: function (msg, data) { log('warn', 1, msg, data); },
    info: function (msg, data) { log('info', 2, msg, data); },
    debug: function (msg, data) { log('debug', 3, msg, data); }
  };
}

function validateConfig(userConfig) {
  var cfg = userConfig || {};
  cfg.sharedSecret = cfg.sharedSecret || DEFAULT_SECRET;
  cfg.staleThreshold = cfg.staleThreshold || STALE_THRESHOLD;
  cfg.replayWindow = cfg.replayWindow || REPLAY_WINDOW;
  cfg.cleanupInterval = cfg.cleanupInterval || CLEANUP_INTERVAL;
  cfg.onTermination = typeof cfg.onTermination === 'function' ? cfg.onTermination : null;
  cfg.onHeartbeat = typeof cfg.onHeartbeat === 'function' ? cfg.onHeartbeat : null;
  cfg.rateLimitWindow = cfg.rateLimitWindow || DEFAULT_RATE_LIMIT_WINDOW;
  cfg.rateLimitHeartbeat = cfg.rateLimitHeartbeat || DEFAULT_RATE_LIMIT_HEARTBEAT;
  cfg.rateLimitTerminate = cfg.rateLimitTerminate || DEFAULT_RATE_LIMIT_TERMINATE;
  cfg.rateLimitSession = cfg.rateLimitSession || DEFAULT_RATE_LIMIT_SESSION;
  cfg.maxBodySize = cfg.maxBodySize || DEFAULT_MAX_BODY_SIZE;
  cfg.logLevel = cfg.logLevel || DEFAULT_LOG_LEVEL;
  cfg.logger = typeof cfg.logger === 'function' ? cfg.logger : null;

  if (process.env.NODE_ENV === 'production' && cfg.sharedSecret === DEFAULT_SECRET) {
    throw new Error(
      'DevToolsTerminator: Default shared secret detected in production environment. ' +
      'Set a unique shared secret via config or the DEVTOLS_SECRET environment variable.'
    );
  }

  return cfg;
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function extractSessionId(req) {
  if (req.query && req.query.session) return req.query.session;
  if (req.headers['x-session-id']) return req.headers['x-session-id'];
  return null;
}

function createMiddleware(userConfig) {
  config = validateConfig(userConfig);
  logger = createLogger(config);

  var heartbeatLimiter = createRateLimiter(config.rateLimitWindow, config.rateLimitHeartbeat);
  var terminateLimiter = createRateLimiter(config.rateLimitWindow, config.rateLimitTerminate);
  var sessionLimiter = createRateLimiter(config.rateLimitWindow, config.rateLimitSession);

  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupStaleSessions, config.cleanupInterval);
    if (cleanupTimer.unref) cleanupTimer.unref();
  }

  logger.info('middleware_initialized', {
    rateLimitWindow: config.rateLimitWindow,
    rateLimitHeartbeat: config.rateLimitHeartbeat,
    rateLimitTerminate: config.rateLimitTerminate,
    rateLimitSession: config.rateLimitSession,
    maxBodySize: config.maxBodySize,
    logLevel: config.logLevel,
    staleThreshold: config.staleThreshold,
    replayWindow: config.replayWindow
  });

  return function (req, res, next) {
    var path = req.path || req.url;
    var ip = req.ip || req.socket.remoteAddress;

    if (path === '/heartbeat' && req.method === 'POST') {
      var hbReset = heartbeatLimiter(ip);
      if (hbReset) {
        res.set('Retry-After', Math.ceil((hbReset - Date.now()) / 1000));
        logger.warn('rate_limit_exceeded', { endpoint: '/heartbeat', ip: ip });
        return res.status(429).json({ error: 'Too many requests', retryAfter: hbReset });
      }
      return handleHeartbeat(req, res);
    }

    if (path === '/terminate' && req.method === 'POST') {
      var tReset = terminateLimiter(ip);
      if (tReset) {
        res.set('Retry-After', Math.ceil((tReset - Date.now()) / 1000));
        logger.warn('rate_limit_exceeded', { endpoint: '/terminate', ip: ip });
        return res.status(429).json({ error: 'Too many requests', retryAfter: tReset });
      }
      return handleTerminate(req, res);
    }

    if (path === '/session' && req.method === 'GET') {
      var sReset = sessionLimiter(ip);
      if (sReset) {
        res.set('Retry-After', Math.ceil((sReset - Date.now()) / 1000));
        logger.warn('rate_limit_exceeded', { endpoint: '/session', ip: ip });
        return res.status(429).json({ error: 'Too many requests', retryAfter: sReset });
      }
      return handleCreateSession(req, res);
    }

    var sessionId = extractSessionId(req);
    if (sessionId && terminatedSessions[sessionId]) {
      return res.status(403).json({
        error: 'Session terminated',
        code: 'SESSION_TERMINATED'
      });
    }

    next();
  };
}

function handleCreateSession(req, res) {
  var sessionId = generateSessionId();
  sessions[sessionId] = {
    lastHeartbeat: Date.now(),
    terminated: false,
    fingerprint: null,
    scriptHash: null
  };
  res.json({ sessionId: sessionId });
}

function handleHeartbeat(req, res) {
  var body = '';
  var aborted = false;
  var maxSize = config.maxBodySize;
  var ip = req.ip || req.socket.remoteAddress;
  req.on('data', function (chunk) {
    if (aborted) return;
    body += chunk;
    if (body.length > maxSize) {
      aborted = true;
      logger.warn('request_body_too_large', { endpoint: '/heartbeat', ip: ip, size: body.length, maxSize: maxSize });
      res.status(413).json({ error: 'Request entity too large' });
    }
  });
  req.on('error', function () {
    if (aborted) return;
    res.status(400).json({ error: 'Request error' });
  });
  req.on('end', function () {
    if (aborted) return;
    try {
      var data = JSON.parse(body);
      var sessionId = extractSessionId(req) || data.sessionId || 'anonymous';

      if (!data.fingerprint || !data.timestamp || !data.signature) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      var payload = data.fingerprint + ':' + (data.scriptHash || '') + ':' + data.timestamp;

      var expectedSig = crypto
        .createHmac('sha256', config.sharedSecret)
        .update(payload)
        .digest('hex');

      if (!timingSafeEqual(data.signature, expectedSig)) {
        logger.error('invalid_signature', { sessionId: sessionId, ip: ip, endpoint: '/heartbeat' });
        if (config.onTermination) {
          try {
            config.onTermination({
              sessionId: sessionId,
              reason: 'SEC_DEVTOOLS_INVALID_SIG',
              timestamp: Date.now(),
              ip: ip
            });
          } catch (e) {}
        }
        return res.status(403).json({ error: 'Invalid signature', code: 'SEC_DEVTOOLS_INVALID_SIG' });
      }

      var now = Date.now();
      var payloadAge = now - data.timestamp;
      if (payloadAge > config.replayWindow || payloadAge < -config.replayWindow) {
        logger.warn('payload_expired', { sessionId: sessionId, ip: ip, payloadAge: payloadAge });
        return res.status(403).json({ error: 'Payload expired' });
      }

      if (!sessions[sessionId]) {
        sessions[sessionId] = {
          lastHeartbeat: now,
          terminated: false,
          fingerprint: data.fingerprint,
          scriptHash: data.scriptHash || null
        };
      } else {
        sessions[sessionId].lastHeartbeat = now;
        sessions[sessionId].fingerprint = data.fingerprint;
        sessions[sessionId].scriptHash = data.scriptHash || null;
      }

      if (config.onHeartbeat) {
        try {
          config.onHeartbeat({
            sessionId: sessionId,
            fingerprint: data.fingerprint,
            timestamp: now
          });
        } catch (e) {}
      }

      res.json({ status: 'ok' });
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
}

function handleTerminate(req, res) {
  var body = '';
  var aborted = false;
  var maxSize = config.maxBodySize;
  var ip = req.ip || req.socket.remoteAddress;
  req.on('data', function (chunk) {
    if (aborted) return;
    body += chunk;
    if (body.length > maxSize) {
      aborted = true;
      logger.warn('request_body_too_large', { endpoint: '/terminate', ip: ip, size: body.length, maxSize: maxSize });
      res.status(413).json({ error: 'Request entity too large' });
    }
  });
  req.on('error', function () {
    if (aborted) return;
    res.status(400).json({ error: 'Request error' });
  });
  req.on('end', function () {
    if (aborted) return;
    try {
      var data = JSON.parse(body);
      var sessionId = extractSessionId(req) || data.sessionId || 'anonymous';

      if (!data.fingerprint || !data.timestamp || !data.signature) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      var payload = data.fingerprint + '::' + data.timestamp;

      var expectedSig = crypto
        .createHmac('sha256', config.sharedSecret)
        .update(payload)
        .digest('hex');

      if (!timingSafeEqual(data.signature, expectedSig)) {
        logger.error('invalid_signature', { sessionId: sessionId, ip: ip, endpoint: '/terminate' });
        if (config.onTermination) {
          try {
            config.onTermination({
              sessionId: sessionId,
              reason: 'SEC_DEVTOOLS_INVALID_SIG',
              timestamp: Date.now(),
              ip: ip
            });
          } catch (e) {}
        }
        return res.status(403).json({ error: 'Invalid signature', code: 'SEC_DEVTOOLS_INVALID_SIG' });
      }

      var now = Date.now();
      var payloadAge = now - data.timestamp;
      if (payloadAge > config.replayWindow || payloadAge < -config.replayWindow) {
        logger.warn('payload_expired', { sessionId: sessionId, ip: ip, payloadAge: payloadAge });
        return res.status(403).json({ error: 'Payload expired' });
      }

      if (sessions[sessionId]) {
        sessions[sessionId].terminated = true;
      }
      terminatedSessions[sessionId] = true;

      if (config.onTermination) {
        try {
          config.onTermination({
            sessionId: sessionId,
            reason: data.reason || 'SEC_DEVTOOLS_UNKNOWN',
            timestamp: now,
            ip: ip
          });
        } catch (e) {}
      }

      res.json({ status: 'terminated' });
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
}

function cleanupStaleSessions() {
  var now = Date.now();
  var threshold = config ? config.staleThreshold : STALE_THRESHOLD;
  var cleaned = [];

  for (var id in sessions) {
    if (sessions.hasOwnProperty(id)) {
      if (terminatedSessions[id]) {
        delete sessions[id];
        cleaned.push({ sessionId: id, reason: 'terminated' });
      } else if (now - sessions[id].lastHeartbeat > threshold) {
        delete sessions[id];
        cleaned.push({ sessionId: id, reason: 'stale' });
      }
    }
  }

  if (cleaned.length > 0 && logger) {
    logger.debug('sessions_cleaned', { count: cleaned.length, sessions: cleaned });
  }
}

function getSessionStore() {
  return sessions;
}

function getTerminatedSessions() {
  return terminatedSessions;
}

module.exports = createMiddleware;
module.exports.createSession = handleCreateSession;
module.exports.getSessionStore = getSessionStore;
module.exports.getTerminatedSessions = getTerminatedSessions;
