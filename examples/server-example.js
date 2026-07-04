'use strict';

var express = require('express');
var path = require('path');
var devtoolsTerminator = require('../src/server/devtools-terminator-server');

var app = express();
var PORT = process.env.PORT || 3000;

var sharedSecret = process.env.DEVTOLS_SECRET || 'your-random-secret-here';

var devtoolsMiddleware = devtoolsTerminator({
  sharedSecret: sharedSecret,
  staleThreshold: 45000,
  replayWindow: 10000,
  onTermination: function (data) {
    console.log('[SECURITY] Session terminated:', JSON.stringify(data));
  },
  onHeartbeat: function (data) {
    console.log('[HEARTBEAT] Received from session:', data.sessionId);
  }
});

app.use('/api/devtools', devtoolsMiddleware);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/protected-data', function (req, res) {
  var sessionId = req.headers['x-session-id'] || req.query.session;
  if (!sessionId) {
    return res.status(401).json({ error: 'No session ID provided' });
  }

  var store = devtoolsTerminator.getTerminatedSessions
    ? devtoolsTerminator.getTerminatedSessions()
    : {};
  if (store[sessionId]) {
    return res.status(403).json({ error: 'Session terminated' });
  }

  res.json({
    message: 'This is protected data.',
    timestamp: Date.now()
  });
});

app.get('/session', function (req, res) {
  devtoolsTerminator.createSession(req, res);
});

app.listen(PORT, function () {
  console.log('DevTools Terminator — Hybrid Demo Server');
  console.log('Server running at http://localhost:' + PORT);
  console.log('');
  console.log('To test with the hybrid client:');
  console.log('  1. Open examples/demo-hybrid.html in a browser');
  console.log('  2. Configure the script to point to this server');
  console.log('');
  console.log('IMPORTANT: Change the shared secret for production use.');
});
