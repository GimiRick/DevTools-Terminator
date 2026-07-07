'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
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

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

// --- Server deep unit tests ---
console.log('');
console.log('::group::Server module - timingSafeEqual resilience');

var serverMod = require(path.join(ROOT, 'src', 'server', 'devtools-terminator-server.js'));

var mw = serverMod({ sharedSecret: 'testsecret', logLevel: 'error' });
var crashed = false;

var mockReq = {
  path: '/heartbeat',
  method: 'POST',
  ip: '127.0.0.1',
  headers: {},
  query: {},
  socket: { remoteAddress: '127.0.0.1' },
  _cbs: {},
  on: function(event, cb) {
    this._cbs[event] = cb;
  }
};

var resStatus = null;
var mockRes = {
  set: function() {},
  status: function(s) { resStatus = s; return this; },
  json: function() {}
};

try {
  mw(mockReq, mockRes, function() {});
  if (mockReq._cbs['data']) {
    var badSig = 'z'.repeat(64);
    mockReq._cbs['data'](JSON.stringify({
      sessionId: 'test1234',
      fingerprint: 'fp',
      timestamp: Date.now(),
      signature: badSig
    }));
  }
  if (mockReq._cbs['end']) {
    mockReq._cbs['end']();
  }
} catch (e) {
  crashed = true;
}

assert(!crashed, 'server did not crash on invalid hex signature');
assert(resStatus === 403, 'server rejected invalid hex signature with 403');

console.log('::endgroup::');

console.log('::group::Server module - validateConfig');

// Test defaults
var cfgPath = path.join(ROOT, 'src', 'server', 'devtools-terminator-server.js');
var code = fs.readFileSync(cfgPath, 'utf-8');
// Check that DEFAULT_SECRET constant is preserved
assert(code.indexOf('change-this-to-a-random-secret') !== -1, 'server source contains default secret placeholder');

// Test that the server module has all expected functions
assert(typeof serverMod === 'function', 'server exports a function (middleware factory)');
assert(typeof serverMod.createSession === 'function', 'server exports createSession');
assert(typeof serverMod.getSessionStore === 'function', 'server exports getSessionStore');
assert(typeof serverMod.getTerminatedSessions === 'function', 'server exports getTerminatedSessions');

console.log('::endgroup::');

console.log('::group::Server module - session ID generation');

var sessionId1 = serverMod.createSession ? (function () {
  // Call createSession via mock req/res
  var sid = null;
  var mockReq = {};
  var mockRes = {
    json: function (data) {
      sid = data.sessionId;
    }
  };
  serverMod.createSession(mockReq, mockRes);
  return sid;
})() : null;

assert(typeof sessionId1 === 'string', 'createSession generates a sessionId string');
assert(sessionId1.length === 64, 'sessionId is 64 hex chars (32 bytes)');
assert(/^[0-9a-f]+$/.test(sessionId1), 'sessionId is hex only');

console.log('::endgroup::');

console.log('::group::Server module - session store isolation');

var store = serverMod.getSessionStore();
var termStore = serverMod.getTerminatedSessions();
assert(typeof store === 'object' && store !== null, 'getSessionStore returns an object');
assert(typeof termStore === 'object' && termStore !== null, 'getTerminatedSessions returns an object');

console.log('::endgroup::');

// --- CLI module tests ---
console.log('::group::CLI module - structure');

var cliCode = fs.readFileSync(path.join(ROOT, 'src', 'cli', 'init.js'), 'utf-8');
assert(cliCode.indexOf('#!/usr/bin/env node') === 0, 'CLI file starts with shebang');
assert(cliCode.indexOf('FILES') !== -1, 'CLI defines FILES map');
assert(cliCode.indexOf('client') !== -1, 'FILES includes client entry');
assert(cliCode.indexOf('hybrid') !== -1, 'FILES includes hybrid entry');
assert(cliCode.indexOf('terminated') !== -1, 'FILES includes terminated entry');

// Verify the FILES paths in CLI match actual files
assert(cliCode.indexOf("'src', 'client', 'devtools-terminator.js'") !== -1,
  'CLI references client source path in FILES');
assert(cliCode.indexOf("'src', 'client', 'devtools-terminator-hybrid.js'") !== -1,
  'CLI references hybrid source path in FILES');
assert(cliCode.indexOf("'public', 'terminated.html'") !== -1,
  'CLI references terminated page in FILES');

console.log('::endgroup::');

// --- Client file ES5 compatibility ---
console.log('::group::Client ES5 compatibility');

var clientCode = fs.readFileSync(path.join(ROOT, 'src', 'client', 'devtools-terminator.js'), 'utf-8');

assert(clientCode.indexOf('class ') === -1, 'client does not use ES6 class');
assert(clientCode.indexOf('let ') === -1, 'client does not use let');
assert(clientCode.indexOf('const ') === -1, 'client does not use const');
assert(clientCode.indexOf('=>') === -1, 'client does not use arrow functions');
assert(clientCode.indexOf('function*') === -1, 'client does not use generators');
assert(clientCode.indexOf('`') === -1, 'client does not use template literals');
assert(clientCode.indexOf('default ') === -1 || clientCode.indexOf('switch') === -1,
  'client does not use default export');
assert(clientCode.indexOf('import ') === -1, 'client does not use import');
assert(clientCode.indexOf('export ') === -1, 'client does not use export');

console.log('::endgroup::');

// --- Client public API structure ---
console.log('::group::Client public API structure');

assert(clientCode.indexOf('DevToolsTerminator') !== -1, 'client exposes DevToolsTerminator');
assert(clientCode.indexOf('version') !== -1, 'DevToolsTerminator has version property');
assert(clientCode.indexOf('isTerminated') !== -1, 'DevToolsTerminator has isTerminated method');
assert(clientCode.indexOf('terminate') !== -1, 'DevToolsTerminator has terminate method');
assert(clientCode.indexOf('config') !== -1, 'DevToolsTerminator has config property');
assert(clientCode.indexOf('Object.freeze') !== -1, 'DevToolsTerminator is frozen');
assert(clientCode.indexOf('REASON_CODES') !== -1, 'client defines REASON_CODES');
assert(clientCode.indexOf('SEC_DEVTOOLS_CONSOLE_001') !== -1, 'reason code CONSOLE defined');
assert(clientCode.indexOf('SEC_DEVTOOLS_SIZE_003') !== -1, 'reason code SIZE defined');
assert(clientCode.indexOf('SEC_DEVTOOLS_KEY_004') !== -1, 'reason code KEY defined');
assert(clientCode.indexOf('SEC_DEVTOOLS_MANUAL') !== -1, 'reason code MANUAL defined');
assert(clientCode.indexOf('SEC_DEVTOOLS_UNKNOWN') !== -1, 'reason code UNKNOWN defined');

console.log('::endgroup::');

// --- Cross-file consistency ---
console.log('::group::Cross-file consistency');

var hybridCode = fs.readFileSync(path.join(ROOT, 'src', 'client', 'devtools-terminator-hybrid.js'), 'utf-8');
var pkg = require(path.join(ROOT, 'package.json'));

// Version consistency: client file, hybrid file, and package.json should all say 0.1.3
assert(clientCode.indexOf("'0.1.3'") !== -1 || clientCode.indexOf('"0.1.3"') !== -1,
  'client file has version 0.1.3');
assert(hybridCode.indexOf("'0.1.3'") !== -1 || hybridCode.indexOf('"0.1.3"') !== -1,
  'hybrid file has version 0.1.3');
assert(pkg.version === '0.1.3', 'package.json version is 0.1.3');

// Termination URL consistency
assert(clientCode.indexOf("'/terminated.html'") !== -1, 'client default terminationURL is /terminated.html');
assert(hybridCode.indexOf("'/terminated.html'") !== -1, 'hybrid default terminationURL is /terminated.html');

// blockInteractions option exists in both client files
assert(clientCode.indexOf('blockInteractions') !== -1, 'client file has blockInteractions option');
assert(hybridCode.indexOf('blockInteractions') !== -1, 'hybrid file has blockInteractions option');

// Reason codes consistency - same codes should appear in both client files
var clientReasons = [
  'SEC_DEVTOOLS_CONSOLE_001',
  'SEC_DEVTOOLS_SIZE_003',
  'SEC_DEVTOOLS_KEY_004',
  'SEC_DEVTOOLS_MANUAL',
  'SEC_DEVTOOLS_UNKNOWN'
];
clientReasons.forEach(function (code) {
  assert(clientCode.indexOf(code) !== -1, 'client file contains ' + code);
});

clientReasons.forEach(function (code) {
  assert(hybridCode.indexOf(code) !== -1, 'hybrid file contains ' + code);
});

console.log('::endgroup::');

// --- Package integrity ---
console.log('::group::Package integrity');

assert(pkg.name === 'devtools-terminator', 'package name is devtools-terminator');
assert(pkg.main === 'src/client/devtools-terminator.js', 'main points to client file');
assert(pkg.browser === 'src/client/devtools-terminator.js', 'browser points to client file');

// Verify all files in "files" exist
var filesList = pkg.files || [];
filesList.forEach(function (f) {
  var full = path.join(ROOT, f.replace(/\/$/, ''));
  assert(fileExists(full), 'packaged file/dir exists: ' + f);
});

// Verify all exports point to real files
var exportsMap = pkg.exports || {};
Object.keys(exportsMap).forEach(function (key) {
  var val = exportsMap[key];
  if (typeof val === 'string') {
    assert(fileExists(path.join(ROOT, val)), 'export "' + key + '" points to existing file: ' + val);
  }
});

// Verify bin scripts exist
assert(pkg.bin && pkg.bin['devtools-terminator'] === './src/cli/init.js',
  'bin entry points to CLI file');
assert(fileExists(path.join(ROOT, 'src', 'cli', 'init.js')),
  'bin CLI file exists');

console.log('::endgroup::');

// --- Summary ---
console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
