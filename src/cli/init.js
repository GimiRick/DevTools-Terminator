#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var readline = require('readline');

var PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

var FILES = {
  'client': {
    src: path.join(PACKAGE_ROOT, 'src', 'client', 'devtools-terminator.js'),
    label: 'Client-Only Detection Library'
  },
  'hybrid': {
    src: path.join(PACKAGE_ROOT, 'src', 'client', 'devtools-terminator-hybrid.js'),
    label: 'Hybrid Detection Library'
  },
  'terminated': {
    src: path.join(PACKAGE_ROOT, 'public', 'terminated.html'),
    label: 'Termination Page'
  }
};

function askQuestion(query) {
  return new Promise(function (resolve) {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(query, function (answer) {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

function confirmOverwrite(filePath) {
  return new Promise(function (resolve) {
    if (!fileExists(filePath)) {
      resolve(true);
      return;
    }
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(
      'File "' + path.basename(filePath) + '" already exists. Overwrite? (y/N) ',
      function (answer) {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      }
    );
  });
}

function copyFile(src, dest) {
  var dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function printSuccess(copied) {
  console.log('\n\x1b[32m✓\x1b[0m DevTools Terminator initialized successfully!\n');
  console.log('Files copied:');
  copied.forEach(function (item) {
    console.log('  \x1b[34m→\x1b[0m ' + item.dest + ' (' + item.label + ')');
  });
  console.log('\n\x1b[1mNext Steps:\x1b[0m');
  console.log('');
  console.log('  For Client-Only setup:');
  console.log('    1. Add a script tag to your HTML:');
  console.log('       <script src="/path/to/devtools-terminator.js"></script>');
  console.log('    2. Add config before the script tag:');
  console.log('       <script>');
  console.log('         window.__DEVTOLS_TERMINATOR_CONFIG__ = {');
  console.log('           terminationURL: "/terminated.html"');
  console.log('         };');
  console.log('       </script>');
  console.log('');
  console.log('  For Hybrid setup:');
  console.log('    1. Configure your Express server with the middleware');
  console.log('    2. Add the hybrid script tag with config:');
  console.log('       <script data-devtools-terminator>');
  console.log('       window.__DEVTOLS_TERMINATOR_CONFIG__ = {');
  console.log('         hybridMode: true,');
  console.log('         serverEndpoint: "/api/devtools",');
  console.log('         sharedSecret: "your-secret-key"');
  console.log('       };');
  console.log('       </script>');
  console.log('       <script src="/path/to/devtools-terminator-hybrid.js"></script>');
  console.log('');
  console.log('  See README.md or docs/ for detailed instructions.\n');
}

async function main() {
  var args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('\nDevTools Terminator - Init CLI');
    console.log('');
    console.log('Usage:');
    console.log('  npx devtools-terminator init [options]');
    console.log('');
    console.log('Options:');
    console.log('  --client        Copy Client-Only files (default)');
    console.log('  --hybrid        Copy Hybrid client files');
    console.log('  --dir <path>    Target directory (default: current directory)');
    console.log('  --yes, -y       Skip all confirmation prompts');
    console.log('  --help, -h      Show this help message');
    console.log('');
    process.exit(0);
  }

  var targetDir = process.cwd();
  var dirArgIndex = args.indexOf('--dir');
  if (dirArgIndex !== -1 && args[dirArgIndex + 1]) {
    targetDir = path.resolve(targetDir, args[dirArgIndex + 1]);
  }

  var skipPrompts = args.includes('--yes') || args.includes('-y');

  var mode = 'client';
  if (args.includes('--hybrid')) {
    mode = 'hybrid';
  } else if (!skipPrompts) {
    console.log('\nDevTools Terminator - Init\n');
    var answer = await askQuestion('Select mode (1: Client-Only, 2: Hybrid) [1]: ');
    if (answer === '2' || answer.toLowerCase() === 'hybrid') {
      mode = 'hybrid';
    }
  }

  var clientFile = mode === 'hybrid' ? FILES.hybrid : FILES.client;
  var copied = [];

  var clientDest = path.join(targetDir, mode === 'hybrid' ? 'devtools-terminator-hybrid.js' : 'devtools-terminator.js');

  if (skipPrompts || (await confirmOverwrite(clientDest))) {
    copyFile(clientFile.src, clientDest);
    copied.push({ dest: clientDest, label: clientFile.label });
  } else {
    console.log('Skipped: ' + path.basename(clientDest));
  }

  var terminatedDest = path.join(targetDir, 'terminated.html');
  if (skipPrompts || (await confirmOverwrite(terminatedDest))) {
    copyFile(FILES.terminated.src, terminatedDest);
    copied.push({ dest: terminatedDest, label: FILES.terminated.label });
  } else {
    console.log('Skipped: ' + path.basename(terminatedDest));
  }

  if (copied.length > 0) {
    printSuccess(copied);
  } else {
    console.log('\nNo files were copied.\n');
  }
}

main().catch(function (err) {
  console.error('Error:', err.message);
  process.exit(1);
});
