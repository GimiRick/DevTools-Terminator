'use strict';

/* ------------------------------------------------------------------
   DevTools Terminator — JavaScript Usage Patterns Demo

   This file demonstrates how to use the DevTools Terminator library
   programmatically in the browser. It is not a runnable script but
   a reference for developers.
   ------------------------------------------------------------------ */

/* --- Client-Only Mode --- */

// 1. Define configuration BEFORE loading the script
window.__DEVTOLS_TERMINATOR_CONFIG__ = {
  terminationURL: '/terminated.html',
  checkInterval: 1000,
  windowSizeCheck: true,
  blockKeyboard: true,
  disableOnMobile: true,
  onTermination: function (reasonCode) {
    console.warn('[DevToolsTerminator] Session terminated. Reason:', reasonCode);
    // Send analytics event
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'devtools_detected', { reason: reasonCode });
    }
  }
};

// 2. Load the library via script tag
//    <script src="path/to/devtools-terminator.js"></script>

// 3. Use the public API after initialization
document.addEventListener('DOMContentLoaded', function () {
  if (window.DevToolsTerminator) {
    console.log('Version:', window.DevToolsTerminator.version);
    console.log('Is terminated:', window.DevToolsTerminator.isTerminated());
    console.log('Config:', window.DevToolsTerminator.config);
  }
});

// 4. Manually trigger termination (e.g., for a logout button)
// eslint-disable-next-line no-unused-vars
function onLogout() {
  if (window.DevToolsTerminator) {
    window.DevToolsTerminator.terminate();
  }
}

/* --- Hybrid Mode --- */

// 1. Configure for hybrid mode
window.__DEVTOLS_TERMINATOR_CONFIG__ = {
  terminationURL: '/terminated.html',
  checkInterval: 1000,
  hybridMode: true,
  serverEndpoint: '/api/devtools',
  sharedSecret: 'your-shared-secret-key',
  onTermination: function (reasonCode) {
    fetch('/api/log-security-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'devtools_detected', reason: reasonCode })
    }).catch(function () {});
  }
};

// 2. Load hybrid script
//    <script src="path/to/devtools-terminator-hybrid.js" data-devtools-terminator></script>

/* --- Server-Side Middleware (Node.js/Express) --- */

// var express = require('express');
// var devtoolsMiddleware = require('devtools-terminator/server');
//
// var app = express();
//
// app.use('/api/devtools', devtoolsMiddleware({
//   sharedSecret: process.env.DEVTOLS_SECRET,
//   onTermination: function (data) {
//     console.log('Termination event:', data);
//   }
// }));

/* --- NoScript Fallback --- */

// Include this in your HTML <head> for users with JavaScript disabled:
//
// <noscript>
//   <meta http-equiv="refresh" content="0;url=/terminated.html">
// </noscript>
