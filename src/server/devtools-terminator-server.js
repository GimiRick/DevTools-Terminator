'use strict';

var crypto = require('crypto');

var DEFAULT_SECRET = 'change-this-to-a-random-secret';
var ENV_EXAMPLE_DEFAULT = 'change-this-to-a-random-64-char-hex-string';
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

var instances = [];

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var bufA = Buffer.from(a, 'hex');
  var bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

function createRateLimiter(windowMs, maxHits) {
  var buckets = Object.create(null);
  var lastCleanup = Date.now();
  return function (key) {
    var now = Date.now();
    var timeSinceCleanup = now - lastCleanup;
    if (timeSinceCleanup > windowMs || timeSinceCleanup < 0) {
      if (timeSinceCleanup < 0) {
        buckets = Object.create(null);
      } else {
        for (var k in buckets) {
          if (Object.prototype.hasOwnProperty.call(buckets, k) && now >= buckets[k].resetAt) {
            delete buckets[k];
          }
        }
      }
      lastCleanup = now;
    }
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
        if (Object.prototype.hasOwnProperty.call(data, key)) {
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
  cfg.sharedSecret = cfg.sharedSecret != null ? cfg.sharedSecret : DEFAULT_SECRET;
  cfg.staleThreshold = cfg.staleThreshold != null ? cfg.staleThreshold : STALE_THRESHOLD;
  cfg.replayWindow = cfg.replayWindow != null ? cfg.replayWindow : REPLAY_WINDOW;
  cfg.cleanupInterval = cfg.cleanupInterval != null ? cfg.cleanupInterval : CLEANUP_INTERVAL;
  cfg.onTermination = typeof cfg.onTermination === 'function' ? cfg.onTermination : null;
  cfg.onHeartbeat = typeof cfg.onHeartbeat === 'function' ? cfg.onHeartbeat : null;
  cfg.rateLimitWindow = cfg.rateLimitWindow != null ? cfg.rateLimitWindow : DEFAULT_RATE_LIMIT_WINDOW;
  cfg.rateLimitHeartbeat = cfg.rateLimitHeartbeat != null ? cfg.rateLimitHeartbeat : DEFAULT_RATE_LIMIT_HEARTBEAT;
  cfg.rateLimitTerminate = cfg.rateLimitTerminate != null ? cfg.rateLimitTerminate : DEFAULT_RATE_LIMIT_TERMINATE;
  cfg.rateLimitSession = cfg.rateLimitSession != null ? cfg.rateLimitSession : DEFAULT_RATE_LIMIT_SESSION;
  cfg.maxBodySize = cfg.maxBodySize != null ? cfg.maxBodySize : DEFAULT_MAX_BODY_SIZE;
  cfg.logLevel = cfg.logLevel != null ? cfg.logLevel : DEFAULT_LOG_LEVEL;
  cfg.logger = typeof cfg.logger === 'function' ? cfg.logger : null;

  if (cfg.sharedSecret === DEFAULT_SECRET || cfg.sharedSecret === ENV_EXAMPLE_DEFAULT) {
    var generated = crypto.randomBytes(32).toString('hex');
    cfg.sharedSecret = generated;
    console.warn('[DevToolsTerminator] WARNING: Default sharedSecret detected. A random 32-byte secret has been generated automatically for this instance.');
    console.warn('[DevToolsTerminator] WARNING: This is NOT safe for multi-instance (cluster/serverless) deployments. Please configure sharedSecret.');
  }

  return cfg;
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function extractSessionId(req) {
  var id = null;
  if (req.headers['x-session-id']) id = req.headers['x-session-id'];
  else if (req.query && req.query.session) id = req.query.session;
  return typeof id === 'string' ? id : null;
}

// Structured Store Interface with Memory implementation
function createMemoryStore(staleThreshold) {
  var sessions = new Map();
  var terminatedSessions = new Map();
  var blockedFingerprints = new Map();
  var lastCleanupIterator = null;

  return {
    createSession: function (sessionId) {
      sessions.set(sessionId, {
        lastHeartbeat: Date.now(),
        terminated: false,
        fingerprint: null,
        scriptHash: null,
        ip: null
      });
    },
    getSession: function (sessionId) {
      return sessions.get(sessionId);
    },
    updateSession: function (sessionId, data) {
      var session = sessions.get(sessionId);
      if (session) {
        for (var k in data) session[k] = data[k];
      } else {
        sessions.set(sessionId, data);
      }
    },
    terminateSession: function (sessionId, fingerprint, ip) {
      var session = sessions.get(sessionId);
      if (session) session.terminated = true;
      terminatedSessions.set(sessionId, Date.now());
      if (fingerprint) blockedFingerprints.set(fingerprint, Date.now());
      if (ip) blockedFingerprints.set('ip:' + ip, Date.now());
    },
    isTerminated: function (sessionId, fingerprint, ip) {
      if (sessionId && terminatedSessions.has(sessionId)) return true;
      if (fingerprint && blockedFingerprints.has(fingerprint)) return true;
      if (ip && blockedFingerprints.has('ip:' + ip)) return true;
      return false;
    },
    cleanup: function (log) {
      if (this._cleaning) return;
      this._cleaning = true;
      var now = Date.now();
      var cleaned = [];
      var count = 0;
      var chunkSize = 5000;

      try {
        if (!lastCleanupIterator) {
          lastCleanupIterator = sessions.entries();
        }

        var result = lastCleanupIterator.next();
        while (!result.done && count < chunkSize) {
          var id = result.value[0];
          var session = result.value[1];
          if (terminatedSessions.has(id)) {
            sessions.delete(id);
            cleaned.push({ sessionId: id, reason: 'terminated' });
          } else if (now - session.lastHeartbeat > staleThreshold) {
            sessions.delete(id);
            cleaned.push({ sessionId: id, reason: 'stale' });
          }
          count++;
          result = lastCleanupIterator.next();
        }

        if (result.done) {
          lastCleanupIterator = null;
        }

        for (var tid of terminatedSessions.keys()) {
          if (now - terminatedSessions.get(tid) > staleThreshold) {
            terminatedSessions.delete(tid);
          }
        }

        for (var blockKey of blockedFingerprints.keys()) {
          if (now - blockedFingerprints.get(blockKey) > staleThreshold * 2) {
            blockedFingerprints.delete(blockKey);
          }
        }

        if (cleaned.length > 0 && log) {
          log.debug('sessions_cleaned', { count: cleaned.length, sessions: cleaned });
        }
      } finally {
        this._cleaning = false;
      }
    },
    _getRawSessions: function() {
      var obj = {};
      sessions.forEach(function(v, k) { obj[k] = v; });
      return obj;
    },
    _getRawTerminated: function() {
      var obj = {};
      terminatedSessions.forEach(function(v, k) { obj[k] = v; });
      return obj;
    }
  };
}

function createMiddleware(userConfig) {
  var cfg = validateConfig(userConfig);
  var log = createLogger(cfg);

  var store = createMemoryStore(cfg.staleThreshold);
  var instance = {
    store: store,
    cleanupTimer: null
  };
  instances.push(instance);

  var heartbeatLimiter = createRateLimiter(cfg.rateLimitWindow, cfg.rateLimitHeartbeat);
  var terminateLimiter = createRateLimiter(cfg.rateLimitWindow, cfg.rateLimitTerminate);
  var sessionLimiter = createRateLimiter(cfg.rateLimitWindow, cfg.rateLimitSession);

  instance.cleanupTimer = setInterval(function () {
    store.cleanup(log);
  }, cfg.cleanupInterval);
  if (instance.cleanupTimer.unref) instance.cleanupTimer.unref();

  log.info('middleware_initialized', {
    rateLimitWindow: cfg.rateLimitWindow,
    rateLimitHeartbeat: cfg.rateLimitHeartbeat,
    rateLimitTerminate: cfg.rateLimitTerminate,
    rateLimitSession: cfg.rateLimitSession,
    maxBodySize: cfg.maxBodySize,
    logLevel: cfg.logLevel,
    staleThreshold: cfg.staleThreshold,
    replayWindow: cfg.replayWindow
  });

  return function (req, res, next) {
    var path = req.path;
    var ip = req.ip || req.socket.remoteAddress;

    if (path === '/heartbeat' && req.method === 'POST') {
      var hbReset = heartbeatLimiter(ip);
      if (hbReset) {
        res.set('Retry-After', Math.ceil((hbReset - Date.now()) / 1000));
        log.warn('rate_limit_exceeded', { endpoint: '/heartbeat', ip: ip });
        return res.status(429).json({ error: 'Too many requests', retryAfter: hbReset });
      }
      return handleHeartbeat(req, res, cfg, log, store);
    }

    if (path === '/terminate' && req.method === 'POST') {
      var tReset = terminateLimiter(ip);
      if (tReset) {
        res.set('Retry-After', Math.ceil((tReset - Date.now()) / 1000));
        log.warn('rate_limit_exceeded', { endpoint: '/terminate', ip: ip });
        return res.status(429).json({ error: 'Too many requests', retryAfter: tReset });
      }
      return handleTerminate(req, res, cfg, log, store);
    }

    if (path === '/session' && req.method === 'GET') {
      var sReset = sessionLimiter(ip);
      if (sReset) {
        res.set('Retry-After', Math.ceil((sReset - Date.now()) / 1000));
        log.warn('rate_limit_exceeded', { endpoint: '/session', ip: ip });
        return res.status(429).json({ error: 'Too many requests', retryAfter: sReset });
      }
      return handleCreateSession(req, res, store);
    }

    var sessionId = extractSessionId(req);
    // Enforce termination blocks
    if (store.isTerminated(sessionId, null, ip)) {
      return res.status(403).json({
        error: 'Session terminated',
        code: 'SESSION_TERMINATED'
      });
    }

    next();
  };
}

function handleCreateSession(req, res, store) {
  var sessionId = generateSessionId();
  store.createSession(sessionId);
  res.json({ sessionId: sessionId });
}

function processHeartbeatData(data, req, res, cfg, log, store, ip) {
  var sessionId = extractSessionId(req) || data.sessionId || generateSessionId();

  if (!data.fingerprint || !data.timestamp || !data.signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Ensure primitives to avoid object coercion stringification bugs
  var fp = String(data.fingerprint);
  var sh = data.scriptHash ? String(data.scriptHash) : '';
  var ts = String(data.timestamp);

  var payload = fp + ':' + sh + ':' + ts;

  var expectedSig = crypto
    .createHmac('sha256', cfg.sharedSecret)
    .update(payload)
    .digest('hex');

  if (!timingSafeEqual(String(data.signature), expectedSig)) {
    log.error('invalid_signature', { sessionId: sessionId, ip: ip, endpoint: '/heartbeat' });
    if (cfg.onTermination) {
      try {
        cfg.onTermination({
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
  var payloadAge = now - Number(data.timestamp);
  if (isNaN(payloadAge) || payloadAge > cfg.replayWindow || payloadAge < -cfg.replayWindow) {
    log.warn('payload_expired', { sessionId: sessionId, ip: ip, payloadAge: payloadAge });
    return res.status(403).json({ error: 'Payload expired' });
  }

  store.updateSession(sessionId, {
    lastHeartbeat: now,
    fingerprint: fp,
    scriptHash: sh || null,
    ip: ip
  });

  if (cfg.onHeartbeat) {
    try {
      cfg.onHeartbeat({
        sessionId: sessionId,
        fingerprint: fp,
        timestamp: now
      });
    } catch (e) {}
  }

  res.json({ status: 'ok' });
}

function handleHeartbeat(req, res, cfg, log, store) {
  var ip = req.ip || req.socket.remoteAddress;

  if (req.body && typeof req.body === 'object') {
    return processHeartbeatData(req.body, req, res, cfg, log, store, ip);
  }

  var body = '';
  var aborted = false;
  var maxSize = cfg.maxBodySize;
  req.on('data', function (chunk) {
    if (aborted) return;
    body += chunk;
    if (body.length > maxSize) {
      aborted = true;
      log.warn('request_body_too_large', { endpoint: '/heartbeat', ip: ip, size: body.length, maxSize: maxSize });
      body = '';
      res.status(413).json({ error: 'Request entity too large' });
      if (req.destroy) req.destroy();
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
      processHeartbeatData(data, req, res, cfg, log, store, ip);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
}

function processTerminateData(data, req, res, cfg, log, store, ip) {
  var sessionId = extractSessionId(req) || data.sessionId || generateSessionId();

  if (!data.fingerprint || !data.timestamp || !data.signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  var fp = String(data.fingerprint);
  var ts = String(data.timestamp);
  var payload = fp + '::' + ts;

  var expectedSig = crypto
    .createHmac('sha256', cfg.sharedSecret)
    .update(payload)
    .digest('hex');

  if (!timingSafeEqual(String(data.signature), expectedSig)) {
    log.error('invalid_signature', { sessionId: sessionId, ip: ip, endpoint: '/terminate' });
    if (cfg.onTermination) {
      try {
        cfg.onTermination({
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
  var payloadAge = now - Number(data.timestamp);
  if (isNaN(payloadAge) || payloadAge > cfg.replayWindow || payloadAge < -cfg.replayWindow) {
    log.warn('payload_expired', { sessionId: sessionId, ip: ip, payloadAge: payloadAge });
    return res.status(403).json({ error: 'Payload expired' });
  }

  store.terminateSession(sessionId, fp, ip);

  if (cfg.onTermination) {
    try {
      cfg.onTermination({
        sessionId: sessionId,
        reason: data.reason ? String(data.reason) : 'SEC_DEVTOOLS_UNKNOWN',
        timestamp: now,
        ip: ip
      });
    } catch (e) {}
  }

  res.json({ status: 'terminated' });
}

function handleTerminate(req, res, cfg, log, store) {
  var ip = req.ip || req.socket.remoteAddress;

  if (req.body && typeof req.body === 'object') {
    return processTerminateData(req.body, req, res, cfg, log, store, ip);
  }

  var body = '';
  var aborted = false;
  var maxSize = cfg.maxBodySize;
  req.on('data', function (chunk) {
    if (aborted) return;
    body += chunk;
    if (body.length > maxSize) {
      aborted = true;
      log.warn('request_body_too_large', { endpoint: '/terminate', ip: ip, size: body.length, maxSize: maxSize });
      body = '';
      res.status(413).json({ error: 'Request entity too large' });
      if (req.destroy) req.destroy();
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
      processTerminateData(data, req, res, cfg, log, store, ip);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
}

module.exports = createMiddleware;
module.exports.createSession = function (req, res) {
  if (instances.length > 0) {
    handleCreateSession(req, res, instances[instances.length - 1].store);
  } else {
    res.status(500).json({ error: 'No middleware instance initialized' });
  }
};
module.exports.getSessionStore = function () {
  return instances.length > 0 ? instances[instances.length - 1].store._getRawSessions() : {};
};
module.exports.getTerminatedSessions = function () {
  return instances.length > 0 ? instances[instances.length - 1].store._getRawTerminated() : {};
};
