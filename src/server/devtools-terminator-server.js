'use strict';

var crypto = require('crypto');

var DEFAULT_SECRET = 'change-this-to-a-random-secret';
var STALE_THRESHOLD = 45000;
var REPLAY_WINDOW = 10000;
var CLEANUP_INTERVAL = 60000;

var sessions = {};
var terminatedSessions = {};
var cleanupTimer = null;
var config = null;

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function validateConfig(userConfig) {
  var cfg = userConfig || {};
  cfg.sharedSecret = cfg.sharedSecret || DEFAULT_SECRET;
  cfg.staleThreshold = cfg.staleThreshold || STALE_THRESHOLD;
  cfg.replayWindow = cfg.replayWindow || REPLAY_WINDOW;
  cfg.cleanupInterval = cfg.cleanupInterval || CLEANUP_INTERVAL;
  cfg.onTermination = typeof cfg.onTermination === 'function' ? cfg.onTermination : null;
  cfg.onHeartbeat = typeof cfg.onHeartbeat === 'function' ? cfg.onHeartbeat : null;

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

  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupStaleSessions, config.cleanupInterval);
    if (cleanupTimer.unref) cleanupTimer.unref();
  }

  return function (req, res, next) {
    var path = req.path || req.url;

    if (path === '/heartbeat' && req.method === 'POST') {
      return handleHeartbeat(req, res);
    }

    if (path === '/terminate' && req.method === 'POST') {
      return handleTerminate(req, res);
    }

    if (path === '/session' && req.method === 'GET') {
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
  req.on('data', function (chunk) { body += chunk; });
  req.on('error', function () {
    res.status(400).json({ error: 'Request error' });
  });
  req.on('end', function () {
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
        if (config.onTermination) {
          try {
            config.onTermination({
              sessionId: sessionId,
              reason: 'SEC_DEVTOOLS_INVALID_SIG',
              timestamp: Date.now(),
              ip: req.ip || req.socket.remoteAddress
            });
          } catch (e) {}
        }
        return res.status(403).json({ error: 'Invalid signature', code: 'SEC_DEVTOOLS_INVALID_SIG' });
      }

      var now = Date.now();
      var payloadAge = now - data.timestamp;
      if (payloadAge > config.replayWindow || payloadAge < -config.replayWindow) {
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
  req.on('data', function (chunk) { body += chunk; });
  req.on('error', function () {
    res.status(400).json({ error: 'Request error' });
  });
  req.on('end', function () {
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
        if (config.onTermination) {
          try {
            config.onTermination({
              sessionId: sessionId,
              reason: 'SEC_DEVTOOLS_INVALID_SIG',
              timestamp: Date.now(),
              ip: req.ip || req.socket.remoteAddress
            });
          } catch (e) {}
        }
        return res.status(403).json({ error: 'Invalid signature', code: 'SEC_DEVTOOLS_INVALID_SIG' });
      }

      var now = Date.now();
      var payloadAge = now - data.timestamp;
      if (payloadAge > config.replayWindow || payloadAge < -config.replayWindow) {
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
            ip: req.ip || req.socket.remoteAddress
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

  for (var id in sessions) {
    if (sessions.hasOwnProperty(id)) {
      if (!terminatedSessions[id] && now - sessions[id].lastHeartbeat > threshold) {
        delete sessions[id];
      }
    }
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
