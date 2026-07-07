'use strict';

var express = require('express');
var crypto = require('crypto');
var devtoolsTerminator = require('../src/server/devtools-terminator-server');

var passed = 0;
var failed = 0;

function assert(ok, msg) {
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error('  FAIL: ' + msg);
  }
}

console.log('');
console.log('::group::Server integration - termination flow');

var app = express();
var server = null;
var port = 0;

app.use(devtoolsTerminator({
  sharedSecret: 'test-secret-that-is-long-enough-for-hmac',
  logLevel: 'error'
}));

app.get('/api/data', function (req, res) {
  res.json({ secret: 'data' });
});

function runSimulation() {
  var baseUrl = 'http://localhost:' + port;
  var fingerprint = crypto.createHash('sha256').update('test-browser-fingerprint').digest('hex');
  var secret = 'test-secret-that-is-long-enough-for-hmac';

  return fetch(baseUrl + '/session').then(function (res) {
    return res.json();
  }).then(function (data) {
    var sessionId1 = data.sessionId;
    assert(typeof sessionId1 === 'string' && sessionId1.length > 0, 'Got session ID: ' + sessionId1);
    console.log('   Session 1: ' + sessionId1);

    var ts = Date.now();
    var payload = fingerprint + '::' + ts;
    var sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    return fetch(baseUrl + '/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId1 },
      body: JSON.stringify({ fingerprint: fingerprint, timestamp: ts, signature: sig })
    }).then(function (res) {
      assert(res.status === 200, 'Heartbeat accepted (status 200), got ' + res.status);
      console.log('   Heartbeat accepted.');

      ts = Date.now();
      payload = fingerprint + '::' + ts;
      sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      return fetch(baseUrl + '/terminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId1 },
        body: JSON.stringify({ fingerprint: fingerprint, timestamp: ts, signature: sig, reason: 'SEC_DEVTOOLS_CONSOLE_001' })
      }).then(function (res) {
        assert(res.status === 200, 'Termination accepted (status 200), got ' + res.status);
        console.log('   Session terminated.');

        return fetch(baseUrl + '/api/data', { headers: { 'x-session-id': sessionId1 } }).then(function (res) {
          assert(res.status === 403, 'Blocked terminated session (status 403), got ' + res.status);
          console.log('   Terminated session correctly rejected (403).');

          return fetch(baseUrl + '/session').then(function (res) {
            return res.json();
          }).then(function (data2) {
            var sessionId2 = data2.sessionId;
            assert(typeof sessionId2 === 'string' && sessionId2.length > 0, 'Got new session ID: ' + sessionId2);
            console.log('   Session 2 (bypass attempt): ' + sessionId2);

            return fetch(baseUrl + '/api/data', { headers: { 'x-session-id': sessionId2 } }).then(function (res) {
              assert(res.status === 403, 'Blocked bypass attempt (status 403), got ' + res.status);
              console.log('   Bypass attempt correctly rejected (403).');
              console.log('::endgroup::');
            });
          });
        });
      });
    });
  });
}

server = app.listen(0, function () {
  port = server.address().port;
  server.unref();
  console.log('   Server started on port ' + port);

  runSimulation().then(function () {
    console.log('');
    console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
    if (failed > 0) {
      console.log('\x1b[31m[FAILED]\x1b[0m Some tests failed.');
      process.exit(1);
    } else {
      console.log('\x1b[32m[SUCCESS]\x1b[0m All integration tests passed!');
    }
  }).catch(function (err) {
    console.error('\n\x1b[31m[FAILED]\x1b[0m ' + err.message);
    process.exit(1);
  });
});
