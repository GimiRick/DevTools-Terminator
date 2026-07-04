'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

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

console.log('');

// --- File existence checks ---
console.log('::group::File existence');

assert(fileExists(path.join(ROOT, 'src', 'client', 'devtools-terminator.js')),
  'src/client/devtools-terminator.js exists');
assert(fileExists(path.join(ROOT, 'src', 'client', 'devtools-terminator-hybrid.js')),
  'src/client/devtools-terminator-hybrid.js exists');
assert(fileExists(path.join(ROOT, 'src', 'server', 'devtools-terminator-server.js')),
  'src/server/devtools-terminator-server.js exists');
assert(fileExists(path.join(ROOT, 'src', 'cli', 'init.js')),
  'src/cli/init.js exists');
assert(fileExists(path.join(ROOT, 'public', 'terminated.html')),
  'public/terminated.html exists');
assert(fileExists(path.join(ROOT, 'package.json')),
  'package.json exists');

console.log('::endgroup::');

// --- Client files are valid JavaScript ---
console.log('::group::JavaScript syntax validation');

var nodeModules = [
  'src/server/devtools-terminator-server.js'
];
var browserFiles = [
  'src/client/devtools-terminator.js',
  'src/client/devtools-terminator-hybrid.js',
  'src/cli/init.js'
];

nodeModules.forEach(function (rel) {
  var full = path.join(ROOT, rel);
  if (!fileExists(full)) {
    assert(false, rel + ' not found');
    return;
  }
  try {
    require(full);
    assert(true, rel + ' loads without error');
  } catch (e) {
    assert(false, rel + ' failed to load: ' + e.message);
  }
});

browserFiles.forEach(function (rel) {
  var full = path.join(ROOT, rel);
  if (!fileExists(full)) {
    assert(false, rel + ' not found');
    return;
  }
  try {
    var code = fs.readFileSync(full, 'utf-8');
    new vm.Script(code, { filename: rel });
    assert(true, rel + ' has valid syntax');
  } catch (e) {
    assert(false, rel + ' syntax error: ' + e.message);
  }
});

console.log('::endgroup::');

// --- Server module exports ---
console.log('::group::Server module exports');

try {
  var serverMod = require(path.join(ROOT, 'src', 'server', 'devtools-terminator-server.js'));
  assert(typeof serverMod === 'function', 'server exports a function (middleware factory)');
  assert(typeof serverMod.createSession === 'function', 'server exports createSession');
  assert(typeof serverMod.getSessionStore === 'function', 'server exports getSessionStore');
  assert(typeof serverMod.getTerminatedSessions === 'function', 'server exports getTerminatedSessions');
} catch (e) {
  assert(false, 'server module load failed: ' + e.message);
}

console.log('::endgroup::');

// --- Package.json consistency ---
console.log('::group::package.json consistency');

var pkg = require(path.join(ROOT, 'package.json'));
assert(!!pkg.name, 'package has a name');
assert(!!pkg.version, 'package has a version');
assert(pkg.main === 'src/client/devtools-terminator.js', 'main points to client file');
assert(pkg.engines.node === '>=20.19.0', 'engine requirement is >=20.19');
assert(Array.isArray(pkg.files), 'files is an array');
assert(pkg.files.indexOf('public/terminated.html') !== -1, 'terminated.html is in files list');

console.log('::endgroup::');

// --- Summary ---
console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
