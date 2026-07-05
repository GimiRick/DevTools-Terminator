# DevTools Terminator

> A lightweight browser security library that detects and prevents Developer Tools access by terminating the session.

![Version](https://img.shields.io/badge/version-0.1.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)
[![npm](https://img.shields.io/npm/v/devtools-terminator)](https://www.npmjs.com/package/devtools-terminator)
![npm weekly](https://img.shields.io/npm/dw/devtools-terminator)
![npm monthly](https://img.shields.io/npm/dm/devtools-terminator)
![Node](https://img.shields.io/badge/node-%3E%3D20.19.0-brightgreen)

DevTools Terminator detects when a user opens browser Developer Tools and immediately terminates their session — wiping all locally stored data and redirecting to a termination page. It uses three independent detection mechanisms, keyboard interception, and full storage sanitization.

The entire library is written in **pure JavaScript** with zero runtime dependencies for the client.

---

## Table of Contents

- [About](#about)
- [Features Overview](#features-overview)
- [Which Version Should I Use?](#which-version-should-i-use)
- [Git Clone Users](#git-clone-users)
- [npm Users](#npm-users)
- [Configuration Reference](#configuration-reference)
- [How It Works](#how-it-works)
- [Public API Reference](#public-api-reference)
- [Browser Compatibility](#browser-compatibility)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

---

## About

Part of the **GimiRick** toolchain. We build open source LLMs and AI systems. Founded by Mohammad Faiz.

---

## Features Overview

### Client-Only Mode

- **Console detection** — secretly monitors console access via a property getter trap
- **Viewport differential** — detects DevTools docked to the side or bottom
- **Keyboard interception** — blocks F12, Ctrl+Shift+I/J/C, Ctrl+U and macOS equivalents
- **UI protection** — disables right-click, text selection, and drag-and-drop
- **Full storage wipe** — clears localStorage, sessionStorage, cookies, IndexedDB, CacheStorage
- **Service Worker cleanup** — unregisters all service workers on termination
- **Mobile detection** — automatically suppresses viewport checks on mobile devices
- **No dependencies** — zero npm packages or CDN resources required
- **CSP compatible** — no eval, no new Function(), no inline event handlers

### Hybrid Mode

All Client-Only features, plus:

- **Cryptographic heartbeats** — HMAC-SHA256 signed proof-of-life signals every 30 seconds
- **Browser fingerprinting** — SHA-256 hashed user agent + screen + timezone
- **Script integrity verification** — server validates the hash of the running script
- **Replay attack protection** — timestamp-validated payloads with configurable window
- **Server-enforced termination** — terminated sessions cannot access protected routes
- **Termination beacon** — fire-and-forget notification via Navigator Beacon API
- **Audit logging** — server-side security event hooks for custom alerting
- **Memory management** — automatic cleanup of stale and terminated sessions
- **Rate limiting** — per-IP throttling on heartbeat, terminate, and session endpoints
- **Request body limits** — configurable max body size prevents OOM attacks
- **Structured logging** — JSON-formatted logs with levels and custom logger support

---

## Which Version Should I Use?

| If you have... | Use... |
| --- | --- |
| A static website, demo, or frontend without a backend | **Client-Only** — no server needed, works immediately |
| A Node.js/Express application | **Hybrid** — server-enforced security with heartbeat validation |
| Low-security requirements (blog, portfolio) | **Client-Only** — sufficient for casual deterrence |
| High-security requirements (admin panel, SaaS) | **Hybrid** — cryptographically validated session security |
| No ability to modify server code | **Client-Only** — drop in and go |

---

## Git Clone Users

This section is for users who obtain the library via `git clone`.

### Prerequisites

- Node.js 20+ (required for the Hybrid server demo and npm operations)
- A local HTTP server for the Client-Only demo (any will do)

### Clone

```bash
git clone https://github.com/GimiRick/DevTools-Terminator.git
cd DevTools-Terminator
```

### Install Dependencies

```bash
npm install
```

This installs the Express dependency required for Hybrid server mode. The client library itself has no dependencies.

### Project Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEVTOOLS TERMINATOR                                 │
│               Browser Security & Anti-DevTools Library                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────────┐
          │                         │                             │
          ▼                         ▼                             ▼
┌───────────────────────┐   ┌───────────────────┐     ┌──────────────────────────┐
│   CLIENT-ONLY MODE    │   │   HYBRID MODE     │     │   SERVER MIDDLEWARE      │
│  (devtools-terminator)│   │(hybrid variant)   │     │  (devtools-terminator-   │
│                       │   │                   │     │   server.js)             │
│   ┌───────────────┐   │   │  ┌────────────┐   │     │                          │
│   │ Detection     │   │   │  │ Detection  │   │     │  ┌────────────────────┐  │
│   │ Mechanisms    │   │   │  │ Mechanisms │   │     │  │ Routes             │  │
│   │               │   │   │  │ (same 4)   │   │     │  │                    │  │
│   │ • Console     │   │   │  └─────┬──────┘   │     │  │ POST /heartbeat    │  │
│   │   Getter Trap │   │   │        │          │     │  │ POST /terminate    │  │
│   │ • Viewport    │   │   │        ▼          │     │  │ GET  /session      │  │
│   │   Diff (>200) │   │   │  ┌─────────────┐  │     │  │ 403 Check (all)    │  │
│   │ • Debugger    │   │   │  │ Heartbeat   │  │     │  └────────────────────┘  │
│   │  Timing(100ms)│   │   │  │ System      │  │     │                          │
│   │ • Keyboard    │   │   │  │             │  │     │  ┌────────────────────┐  │
│   │   Interception│   │   │  │ HMAC-SHA256 │  │     │  │ Session Store      │  │
│   └───────┬───────┘   │   │  │ Fingerprint │  │     │  │ (in-memory)        │  │
│           │           │   │  │ Script Hash │  │     │  │                    │  │
│           ▼           │   │  │ 30s interval│  │     │  │ lastHeartbeat      │  │
│  ┌───────────────┐    │   │  └──────┬──────┘  │     │  │ terminated: bool   │  │
│  │ Termination   │    │   │         │         │     │  │ fingerprint        │  │
│  │ Sequence      │    │   │         ▼         │     │  │ scriptHash         │  │
│  │               │    │   │  ┌─────────────┐  │     │  └────────────────────┘  │
│  │ 1. Atomic flag│    │   │  │ Beacon      │  │     │                          │
│  │ 2. Clear      │    │   │  │ (sendBeacon)│  │     │  ┌────────────────────┐  │
│  │    intervals  │    │   │  │ fire-and-   │  │     │  │ Security Hooks     │  │
│  │ 3. Callback   │    │   │  │ forget      │  │     │  │                    │  │
│  │ 4. Wipe all   │    │   │  └─────────────┘  │     │  │ onTermination()    │  │
│  │    storage    │    │   └────────┬──────────┘     │  │ onHeartbeat()      │  │
│  │ 5. redirect   │    │            │                │  └────────────────────┘  │
│  │    (replace)  │    │            │                │                          │
│  └───────┬───────┘    │            │                │  ┌────────────────────┐  │
│          │            │            └────────────────┼▶│ Production Guard   │  │  
│          ▼            │                             │  │ (rejects default   │  │
│  ┌───────────────┐    │                             │  │  secret in prod)   │  │
│  │ Storage Wipe  │    │                             │  └────────────────────┘  │
│  │               │    │                             │                          │
│  │ • localStorage│    │  ┌───────────────────┐      │  ┌────────────────────┐  │
│  │ • session     │    │  │   CLI INIT        │      │  │ Cleanup Routine    │  │
│  │   Storage     │    │  │ (npx devtools-    │      │  │ (60s interval,     │  │
│  │ • Cookies     │    │  │  terminator init) │      │  │  stale >45s)       │  │
│  │ • IndexedDB   │    │  │                   │      │  └────────────────────┘  │
│  │ • CacheStorage│    │  │ --client (default)│      │                          │
│  │ • Service     │    │  │ --hybrid          │      └──────────────────────────┘
│  │   Workers     │    │  │ --dir <path>      │
│  └───────────────┘    │  │ --yes             │
│                       │  └───────────────────┘
└───────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────────┐
          │                         │                             │
          ▼                         ▼                             ▼
┌─────────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐
│  PUBLIC / STATIC    │   │    EXAMPLES      │   │       DOCS               │
│                     │   │                  │   │                          │
│  terminated.html    │   │ demo.html        │   │ GETTING_STARTED.md       │
│  (termination page) │   │ server-example.js│   │ HYBRID_SETUP.md          │
│                     │   │ usage-demo.js    │   │ WHICH_FILES.md           │
│                     │   │                  │   │ SECURITY.md              │
│                     │   │                  │   │ CHANGELOG.md             │
└─────────────────────┘   └──────────────────┘   └──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONFIGURATION LAYER                                  │
│          window.__DEVTOOLS_TERMINATOR_CONFIG__ (frozen after init)          │
│                                                                             │
│  terminationURL  │  checkInterval  │  windowSizeCheck  │  blockKeyboard     │
│  blockInteractions │  disableOnMobile │  onTermination  │  hybridMode       │
│  serverEndpoint  │  sharedSecret   │                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC API                                           │
│           window.DevToolsTerminator (frozen read-only)                      │
│                                                                             │
│  version  │  isTerminated()  │  terminate()  │  config                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Run the Client-Only Demo

Start any HTTP server in the project root:

```bash
npx http-server . -p 8080
```

Then open `http://localhost:8080/examples/demo.html` in your browser. The page is protected by the Client-Only library. Try opening DevTools to see the termination sequence.

### Run the Hybrid Server Demo

1. Copy `.env.example` to `.env` and generate a strong secret:

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" >> .env
```

2. Start the server:

```bash
node examples/server-example.js
```

3. Create an HTML page that loads the hybrid client and points to the server.

### Client-Only: Copy Files Into Your Project

Copy these files:

```bash
cp src/client/devtools-terminator.js /path/to/your/project/js/
cp public/terminated.html /path/to/your/project/public/
```

Then add the script tag to your HTML:

```html
<script>
  window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
    terminationURL: '/terminated.html'
  };
</script>
<script src="/js/devtools-terminator.js"></script>
```

### Hybrid: Copy Files Into Your Project

```bash
cp src/client/devtools-terminator-hybrid.js /path/to/your/project/js/
cp src/server/devtools-terminator-server.js /path/to/your/project/server/
cp public/terminated.html /path/to/your/project/public/
```

See `docs/HYBRID_SETUP.md` for detailed server and client configuration.

---

## npm Users

This section is for users who install the library via npm.

### Install

```bash
npm install devtools-terminator
```

### CLI Init Command

The fastest way to get started is the `init` command:

```bash
npx devtools-terminator init
```

This interactive command will:

1. Ask whether you want Client-Only or Hybrid mode
2. Copy the appropriate client JS file into your current directory
3. Copy the `terminated.html` page into your current directory
4. Print a success message with next steps

You can also use flags:

```bash
npx devtools-terminator init --client          # Client-Only mode (default)
npx devtools-terminator init --hybrid          # Hybrid mode
npx devtools-terminator init --dir ./public    # Specify target directory
npx devtools-terminator init --yes             # Skip confirmation prompts
```

The init command will never overwrite existing files without asking for confirmation first.

### Load via Script Tag

After running `init`, link the copied files:

```html
<script>
  window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
    terminationURL: '/terminated.html'
  };
</script>
<script src="/path/to/devtools-terminator.js"></script>
```

Or reference the file directly from `node_modules`:

```html
<script src="/node_modules/devtools-terminator/src/client/devtools-terminator.js"></script>
```

### Import via Bundler (Vite, Webpack)

```javascript
// Client-Only
import 'devtools-terminator';

// Or with explicit config
window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
  terminationURL: '/terminated.html'
};
import 'devtools-terminator';
```

```javascript
// Hybrid
window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
  hybridMode: true,
  serverEndpoint: '/api/devtools',
  sharedSecret: 'your-secret-key'
};
import 'devtools-terminator/hybrid';
```

### Import Server Module

```javascript
const devtoolsMiddleware = require('devtools-terminator/server');

app.use('/api/devtools', devtoolsMiddleware({
  sharedSecret: process.env.DEVTOOLS_SECRET,
  rateLimitHeartbeat: 60,
  rateLimitTerminate: 10,
  rateLimitSession: 30,
  maxBodySize: 10240,
  logLevel: 'info'
}));
```

### Environment Variables

Create a `.env` file:

```ini
DEVTOOLS_SECRET=your-64-char-hex-string
PORT=3000
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Published Package

The npm package includes only:

- `src/` — all source files
- `public/terminated.html` — the termination page
- `README.md` — this file
- `LICENSE` — MIT License

The following are excluded from the published package:

- `examples/` — demos and usage examples
- `docs/` — documentation files
- `.env.example` — environment template
- `BUILD.md` — build specification

---

## Configuration Reference

Configure the library by defining `window.__DEVTOOLS_TERMINATOR_CONFIG__` before the script loads. The configuration object is frozen after initialization and cannot be modified at runtime.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `terminationURL` | `string` | `'/terminated.html'` | URL to redirect to on detection |
| `checkInterval` | `number` | `1000` | Detection loop polling interval in ms |
| `windowSizeCheck` | `boolean` | `true` | Enable viewport differential detection |
| `blockKeyboard` | `boolean` | `true` | Intercept DevTools keyboard shortcuts |
| `blockInteractions` | `boolean` | `true` | Block right-click, text selection, and drag |
| `disableOnMobile` | `boolean` | `true` | Suppress checks on mobile devices |
| `onTermination` | `function` | `null` | Callback executed on detection (receives reason code) |
| `hybridMode` | `boolean` | `false` | Enable heartbeat system (Hybrid only) |
| `serverEndpoint` | `string` | `''` | Server URL for heartbeats and beacons (Hybrid only) |
| `sharedSecret` | `string` | `''` | HMAC key matching server config (Hybrid only) |

```html
<!-- Block everything (default) -->
<script>
  window.__DEVTOOLS_TERMINATOR_CONFIG__ = {};
</script>

<!-- Allow right-click, text selection, and drag (keep keyboard blocking) -->
<script>
  window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
    blockInteractions: false
  };
</script>

<!-- Allow keyboard shortcuts (keep right-click etc. blocked) -->
<script>
  window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
    blockKeyboard: false
  };
</script>

<!-- Allow everything -->
<script>
  window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
    blockKeyboard: false,
    blockInteractions: false
  };
</script>
```

### Server Middleware Configuration

Configure the server middleware by passing options to `devtoolsTerminator()`:

```javascript
const devtoolsMiddleware = devtoolsTerminator({
  sharedSecret: process.env.DEVTOOLS_SECRET,
  rateLimitHeartbeat: 60,    // 60 heartbeats/min per IP
  rateLimitTerminate: 10,    // 10 terminate beacons/min per IP
  rateLimitSession: 30,      // 30 session creations/min per IP
  maxBodySize: 10240,        // 10KB max request body
  logLevel: 'info',          // error | warn | info | debug
  logger: null               // custom logger function (receives structured entries)
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `rateLimitWindow` | `number` | `60000` | Rate limit window in ms |
| `rateLimitHeartbeat` | `number` | `60` | Max heartbeats per window per IP |
| `rateLimitTerminate` | `number` | `10` | Max termination beacons per window per IP |
| `rateLimitSession` | `number` | `30` | Max session creations per window per IP |
| `maxBodySize` | `number` | `10240` | Maximum request body size in bytes |
| `logLevel` | `string` | `'info'` | Log level: `error`, `warn`, `info`, `debug` |
| `logger` | `function` | `null` | Custom logger — receives `{time, level, msg, module, ...}` |

When no custom logger is provided, the middleware writes JSON-formatted log entries to stdout (info, debug) and stderr (warn, error).

---

## How It Works

### Console Object Property Getter

A specially crafted object is created in memory with a property whose getter function fires silently when the browser's DevTools console reads and evaluates it. Under normal conditions (DevTools closed) this getter is never called. The moment a user opens their console, the browser evaluates the object, triggering the getter and initiating termination. This is the primary and most reliable detection method.

### Viewport Dimension Differential

When DevTools are docked to the side or bottom of the browser window, the visible page area (inner dimensions) shrinks while the overall browser window size (outer dimensions) stays the same. The tool continuously measures the difference between these two values. When the gap exceeds a defined pixel threshold (200px), it signals that a panel has been attached — indicating DevTools. This check is automatically skipped on mobile devices to avoid false positives.

### Termination Sequence

When any detection method fires, the following happens in strict order:

1. An internal atomic flag is set to prevent the sequence from running more than once
2. All active polling intervals are cleared
3. Any user-defined callback function is executed
4. In Hybrid Mode: a termination beacon is sent to the server via the Beacon API
5. All local storage is wiped: localStorage, sessionStorage, cookies (across all domain variants), IndexedDB databases, CacheStorage entries
6. All registered Service Workers are unregistered
7. The browser is redirected to the termination page via `location.replace()` (prevents back-button navigation)

### Cryptographic Heartbeat System (Hybrid)

The browser sends a heartbeat to the server every 30 seconds. Each heartbeat contains:

- A **browser fingerprint** — SHA-256 hash of user agent + screen dimensions + timezone
- A **script integrity hash** — SHA-256 hash of the running script's source code
- A **timestamp** — used for replay attack prevention

The payload is signed with **HMAC-SHA256** using a shared secret. The server verifies the signature using a timing-safe comparison, checks the timestamp is within the replay window, and updates the session's last-seen time.

**If a heartbeat doesn't arrive within 45 seconds, or if the server receives a termination beacon, the session is marked as terminated.** All subsequent API requests from that session get a **403 Forbidden** response. The server keeps a list of terminated sessions and checks every incoming request against it.

**However**, the shared secret is embedded in the client code. Since it is a symmetric key (HMAC-SHA256) living in the browser, it is not a secret. A determined attacker can:

- Search the client JS for the secret string or set a breakpoint where the HMAC is generated and read the key from memory
- Write a short script using `requests` and `hashlib` to generate valid HMAC signatures
- Route their traffic through a proxy (Burp Suite, mitmproxy, etc.) and feed valid heartbeats to the server

The server cannot cryptographically tell the difference between a real browser and a script forging heartbeats. Hybrid mode stops users who open DevTools, but **it does not protect against a proxy-level attacker.**

---

## Public API Reference

After initialization, the library exposes a read-only API on `window.DevToolsTerminator`:

| Member | Type | Description |
| --- | --- | --- |
| `version` | `string` | The current library version |
| `isTerminated()` | `function` | Returns `true` if the session has been terminated |
| `terminate()` | `function` | Manually triggers the full termination sequence |
| `config` | `object` | Read-only reference to the active configuration |

---

## Browser Compatibility

| Browser | Minimum Version | Platform | Status |
| --- | --- | --- | --- |
| Firefox | 88+ | Windows, macOS, Linux | Full support |
| Safari | 14+ | macOS, iOS | Full support |
| Microsoft Edge | 90+ | Windows, macOS | Full support |
| Opera | 76+ | Windows, macOS | Full support |
| Chrome | Desktop | Windows, macOS | Partial (see note) |
| Chrome Mobile | Latest | Android | Full support |
| Brave | Latest | All | Full support |
| Vivaldi | Latest | All | Full support |
| Arc | Latest | macOS | Full support |

**Note on Chrome:** DevTools-Terminator works on Windows and Mac. But Chrome's DevTools are very optimized, so some detection features may work differently on Windows and Mac. On Linux, it may not work at all.

---

## Security Considerations

DevTools Terminator is a **deterrent layer**, not a replacement for server-side security. It raises the bar against casual and intermediate inspection but cannot stop a determined attacker with full control over their machine.

**What it protects against:**

- Casual users pressing F12 or right-clicking to inspect
- Users opening the browser console out of curiosity
- Automated scrapers that rely on DevTools APIs
- Brute-force and DoS attacks against server endpoints (via rate limiting)
- Memory exhaustion via oversized request bodies (via body size limits)

**What it does NOT protect against:**

- Users who disable JavaScript (mitigated by the noscript fallback)
- Users who modify the script before it loads (mitigated by the hybrid script integrity check)
- Browser extensions that modify page content
- Proxy-based traffic interception
- Physical access attacks

For production applications, combine this tool with server-side authentication, Content Security Policy, Subresource Integrity, HTTPS, and backend authorization. See [`SECURITY.md`](SECURITY.md) for our security policy or `docs/SECURITY.md` for a full discussion.

---

## Contributing

Contributions are welcome! All contributions must be in **JavaScript** — no TypeScript source files are accepted.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For detailed guidelines, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Changelog

## [0.1.2] — 2026-07-06

### Removed

- Debugger timing detection removed entirely — caused false positives on Chromium-based browsers

For full version history, see `docs/CHANGELOG.md`.

---

## License

MIT License. Copyright (c) 2026 GimiRick.

See the [LICENSE](LICENSE) file for details.
