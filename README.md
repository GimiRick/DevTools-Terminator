# DevTools Terminator

> A lightweight browser security library that detects and prevents Developer Tools access by terminating the session.

![Version](https://img.shields.io/badge/version-0.1.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)
[![npm](https://img.shields.io/npm/v/devtools-terminator)](https://www.npmjs.com/package/devtools-terminator)
![npm weekly](https://img.shields.io/npm/dw/devtools-terminator)
![npm monthly](https://img.shields.io/npm/dm/devtools-terminator)
![Node](https://img.shields.io/badge/node-%3E%3D20.19.0-brightgreen)

DevTools Terminator detects when a user opens browser Developer Tools and immediately terminates their session by wiping all locally stored data and redirecting to a termination page. It uses two independent detection mechanisms, keyboard interception, and full storage sanitization.

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

- **Console getter trap** — monitors console access via a property getter on a plain object, logged every 100ms (keeps a live entry in Chrome's ring buffer)
- **Viewport differential** — detects DevTools docked to the side (150px width diff) or bottom (170px height diff), checked every 100ms
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
- **Termination beacon** — fire-and-forget notification via `fetch({ keepalive: true })` (with `navigator.sendBeacon` fallback)
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
│                          DEVTOOLS TERMINATOR                                │
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
│   │ Mechanisms    │   │   │  │ Mechanisms │   │     │  │      Routes        │  │
│   │               │   │   │  │ (same)     │   │     │  │                    │  │
│   │ • Console     │   │   │  └─────┬──────┘   │     │  │ POST /heartbeat    │  │
│   │   Getter Trap │   │   │        │          │     │  │ POST /terminate    │  │
│   │ • Viewport    │   │   │        ▼          │     │  │ GET  /session      │  │
│   │   W+H Diff    │   │   │  ┌─────────────┐  │     │  │ 403 Check (all)    │  │
│   │   (150/170px) │   │   │  │ Heartbeat   │  │     │  └────────────────────┘  │
│   │ • Keyboard    │   │   │  │ System      │  │     │                          │
│   │   Interception│   │   │  │             │  │     │  ┌────────────────────┐  │
│   │               │   │   │  │ HMAC-SHA256 │  │     │  │ Session Store      │  │
│   │               │   │   │  │             │  │     │  │ (in-memory)        │  │
│   └───────┬───────┘   │   │  │ Fingerprint │  │     │  │ (in-memory)        │  │
│           │           │   │  │ Script Hash │  │     │  │                    │  │
│           ▼           │   │  │ 30s interval│  │     │  │ lastHeartbeat      │  │
│  ┌───────────────┐    │   │  └──────┬──────┘  │     │  │ terminated: bool   │  │
│  │ Termination   │    │   │         │         │     │  │ fingerprint        │  │
│  │ Sequence      │    │   │         ▼         │     │  │ scriptHash         │  │
│  │               │    │   │  ┌─────────────┐  │     │  └────────────────────┘  │
│  │ 1. Atomic flag│    │   │  │ Beacon      │  │     │                          │
│  │ 2. Clear      │    │   │  │ (keepalive) │  │     │  ┌────────────────────┐  │
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
│  terminationURL  │  windowSizeCheck  │  blockKeyboard       │               │
│  blockInteractions │  disableOnMobile │  onTermination  │  hybridMode       │
│  serverEndpoint  │  sharedSecret   │                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC API                                           │
│           window.DevToolsTerminator (frozen read-only)                      │
│                                                                             │
│  version  │  isTerminated()  │  terminate()  │  config  │  _status()        │
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


---

## Configuration Reference

Configure the library by defining `window.__DEVTOOLS_TERMINATOR_CONFIG__` before the script loads. The configuration object is frozen after initialization and cannot be modified at runtime.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `terminationURL` | `string` | `'/terminated.html'` | URL to redirect to on detection |
| `windowSizeCheck` | `boolean` | `true` | Enable viewport differential detection |
| `blockKeyboard` | `boolean` | `true` | Intercept DevTools keyboard shortcuts |
| `blockInteractions` | `boolean` | `true` | Block right-click, text selection, and drag |
| `disableOnMobile` | `boolean` | `true` | Suppress checks on mobile devices |
| `onTermination` | `function` | `null` | Callback executed on detection (receives reason code) |
| `hybridMode` | `boolean` | `true` | Enable heartbeat system (Hybrid only) |
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
| `sharedSecret` | `string` | `'change-this-to-a-random-secret'` | HMAC key — must match client config |
| `rateLimitWindow` | `number` | `60000` | Rate limit window in ms |
| `rateLimitHeartbeat` | `number` | `60` | Max heartbeats per window per IP |
| `rateLimitTerminate` | `number` | `10` | Max termination beacons per window per IP |
| `rateLimitSession` | `number` | `30` | Max session creations per window per IP |
| `maxBodySize` | `number` | `10240` | Maximum request body size in bytes |
| `logLevel` | `string` | `'info'` | Log level: `error`, `warn`, `info`, `debug` |
| `logger` | `function` | `null` | Custom logger — receives `{time, level, msg, module, ...}` |
| `staleThreshold` | `number` | `45000` | Session stale timeout in ms (no heartbeat grace) |
| `replayWindow` | `number` | `10000` | Replay attack prevention window in ms |
| `cleanupInterval` | `number` | `60000` | Stale session cleanup interval in ms |
| `onTermination` | `function` | `null` | Callback on termination — receives `{sessionId, reason, timestamp, ip}` |
| `onHeartbeat` | `function` | `null` | Callback on heartbeat — receives `{sessionId, fingerprint, timestamp}` |

When no custom logger is provided, the middleware writes JSON-formatted log entries to stdout (info, debug) and stderr (warn, error).

---

## How It Works

### Console Object Property Getter

A plain object with an enumerable getter property is logged to the console every 100ms. When DevTools is closed, Chrome's console no-op stub stores a reference without evaluating the object's properties — the getter never fires. When DevTools opens and processes the buffered log entry, Chrome evaluates the object for display, triggering the getter and initiating termination.

On Firefox, getters are evaluated eagerly even during no-op stub processing, making this approach cross-browser compatible.

### Viewport Dimension Differential

Two static checks run every 100ms:

- **Width:** `outerWidth - innerWidth > 150` — catches DevTools docked to the right side. A 150px threshold safely clears extension sidebars (typically 50–120px) while reliably catching all DevTools panels (≥200px).
- **Height:** `outerHeight - innerHeight > 170` — catches DevTools docked to the bottom. The threshold is safely above browser chrome (typically 70–136px on Windows/Mac).

A **delta tracking** check complements the static checks by monitoring sudden drops in `innerWidth` or `innerHeight` while both `outerWidth` and `outerHeight` stay nearly constant. This catches the exact moment of DevTools side-docking or bottom-docking mid-session, even if the final panel is narrower than the static thresholds.

### Termination Sequence

When any detection method fires, the following happens in strict order:

1. An internal atomic flag is set to prevent the sequence from running more than once
2. All active polling intervals are cleared
3. Any user-defined callback function is executed
4. In Hybrid Mode: a termination beacon is sent to the server via `fetch({ keepalive: true })` (preferred) or `navigator.sendBeacon()` (fallback)
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

### Session State Machine (Server)

```
Client                          Server
  |                               |
  |-- GET /session -------------->|  Creates session entry (active)
  |<-- { sessionId } ------------|
  |                               |
  |-- POST /heartbeat (30s) ---->|  Validates HMAC, timestamp, updates lastHeartbeat
  |<-- { status: 'ok' } ---------|
  |                               |
  |-- POST /terminate ---------->|  Marks session.terminated = true
  |                               |  Adds to terminatedSessions
  |                               |
  |-- GET /api/* --------------->|  Checks terminatedSessions → 403 if terminated
  |                               |
  |--- [45s no heartbeat] -------|  cleanupStaleSessions() removes entry
```

---

## Public API Reference

After initialization, the library exposes a read-only API on `window.DevToolsTerminator`:

| Member | Type | Description |
| --- | --- | --- |
| `version` | `string` | The current library version |
| `isTerminated()` | `function` | Returns `true` if the session has been terminated |
| `terminate()` | `function` | Manually triggers the full termination sequence |
| `config` | `object` | Read-only reference to the active configuration |
| `_status()` | `function` | Returns diagnostic info: viewport dimensions, mobile state, interval count |

---

## Browser Compatibility

| Browser | Minimum Version | Platform | Status |
| --- | --- | --- | --- |
| Firefox | 88+ | Windows, macOS, Linux | Full support |
| Safari | 14+ | macOS, iOS | Full support |
| Microsoft Edge | 90+ | Windows, macOS | Partial (see note) |
| Opera | 76+ | Windows, macOS | Partial (see note) |
| Chrome | Desktop | Windows, macOS | Partial (see note) |
| Chrome Mobile | Latest | Android | Full support |
| Brave | Latest | All | Not supported (see note below) |
| Vivaldi | Latest | All | Partial (see note) |
| Arc | Latest | macOS | Partial (see note) |

**Note on Chromium-based browsers (Chrome, Edge, Opera, Vivaldi, Arc):** Chromium's no-op console stub (DevTools closed) does not evaluate getters on logged objects — the getter trap only fires when DevTools processes the buffered log entry. Repeated `console.log(obj)` every 100ms ensures a fresh entry is always in the ring buffer. Viewport detection provides the primary detection path on these browsers, catching both side-docked (150px width diff) and bottom-docked (170px height diff) DevTools. Undocked DevTools in a separate window remain a known fundamental limitation of JavaScript-based detection. This applies to all Chromium-based browsers listed above; they share the same DevTools console implementation.

**Note on Brave (Shields feature):** This library does **not** work on Brave Browser when its built-in **Shields** feature is enabled (Shields is enabled by default on Brave). Shields is Brave's privacy protection layer that blocks trackers and prevents browser fingerprinting. Multiple Shields protections directly interfere with the library's detection mechanisms:

1. **`window.outerWidth` / `window.outerHeight` spoofing** (viewport detection breakage): Brave Shields replaces these APIs with static, spoofed values (approximately 982×620) that do not reflect the actual browser window dimensions. The library's viewport differential detection relies on comparing `outerWidth - innerWidth > 150` and `outerHeight - innerHeight > 170` to detect docked DevTools. Since Brave Shields freezes these values regardless of DevTools state, the viewport check never triggers. [Confirmed by Brave Community bug report.](https://community.brave.app/t/brave-shields-modifies-window-screenx-window-screeny-window-outerwidth-and-window-outerheight-causing-incorrect-window-coordinates-to-be-reported/654684)

2. **API farbling (fingerprinting randomization)**: Brave's fingerprinting protection (farbling) randomizes or blocks dozens of browser APIs per session and per site. The hybrid mode browser fingerprint (SHA-256 hash of `navigator.userAgent` + `screen.width` x `screen.height` + `Intl.DateTimeFormat` timezone) produces inconsistent values because Brave spoofs `userAgent`, `screen.width`, and `screen.height`. This breaks the cryptographic heartbeat fingerprint binding.

3. **Console API modifications**: Brave Shields can alter how the console buffers and evaluates logged objects, potentially breaking the console getter trap detection mechanism.

Since Shields is enabled by default on all pages in Brave, the library is effectively non-functional on this browser unless the user manually disables Shields for the site (click the lion icon in the address bar → toggle Shields off). This is a deliberate browser-level privacy protection that cannot be bypassed by JavaScript.

Other Chromium-based browsers (Chrome, Edge, Opera, Vivaldi, Arc) do not have Brave's Shields fingerprinting protection and function as described in the Chromium note above — viewport detection works, console detection works when DevTools is open, but the console getter trap is subject to the same Chromium no-op stub limitation.

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
- Browsers with built-in fingerprinting protection that spoofs window dimension APIs (e.g., Brave Shields)
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

## [0.1.2] — 2026-07-07

### Added (0.1.2)

- `fetchWithTimeout(url, opts, timeoutMs)` helper with `AbortController` — hybrid fetch calls now time out after 5 seconds instead of hanging indefinitely
- Session ID transmitted via `X-Session-ID` header (preferred) with `sendBeacon` query param fallback — avoids leaking session IDs into server access logs, proxy logs, and browser history via URL
- ESLint `no-restricted-syntax` rules to enforce `var` over `let`/`const` in client files; `caughtErrors: 'none'` added to `no-unused-vars` rule
- Hybrid mode startup warning when page is not served over HTTPS — `crypto.subtle` and `fetch` require secure context
- `destructiveClear` config option (default `false`) — storage wiping (localStorage, sessionStorage, cookies, IndexedDB, caches, service workers) on termination is now opt-in to prevent accidental data loss
- `createMemoryStore()` — structured store interface using `Map` for session and termination data with built-in fingerprint and IP blocking support
- Fingerprint and IP blocking on termination — terminated sessions now block the originating fingerprint and IP, preventing bypass by requesting a new session ID from the same device or network
- Chunked cleanup (5,000 sessions per tick) — prevents event loop blocking when cleaning large session stores
- Integration test (`test/verification-simulation.js`) — end-to-end server simulation validating the termination flow and IP blocking persistence
- Viewport detection now checks both width (150px) and height (170px) — catches side-docked DevTools on Chrome/Chromium (width check safely above browser chrome, below typical extension sidebar widths)
- Viewport detection interval reduced from 1000ms to 100ms for near-instant response
- Viewport delta tracking with outer dimension stability check (catches mid-session docking)
- `DevToolsTerminator._status()` diagnostic method — returns current viewport dimensions, `isMobile`, `windowSizeCheck` state and other debug info
- Repeated `console.log(obj)` every 100ms keeps a live entry in Chrome's ring buffer (was once during init; the single entry could be evicted before DevTools opens)

### Fixed

- **Prototype pollution hardening**: rate-limiting `buckets` now use `Object.create(null)` instead of plain objects (`{}`), preventing prototype pollution via crafted IP keys. Session and termination stores migrated to `Map` which is inherently immune to prototype pollution
- **Payload timestamp replay bypass**: `Number(data.timestamp)` with `isNaN(payloadAge)` guard prevents NaN-based replay window bypass. Previously, a non-numeric timestamp produced `NaN` in `now - data.timestamp`, and `NaN > cfg.replayWindow` is always `false`, allowing expired payloads to pass validation
- **Type coercion in HMAC payload construction**: Explicit `String(data.fingerprint)`, `String(data.scriptHash)`, and `String(data.timestamp)` prevent signature validation bypass if an attacker sends non-string values that produce different stringification in payload vs. the client's calculation. `String(data.signature)` ensures `timingSafeEqual` receives a string even if the attacker sends a non-string signature
- **Express body-parser compatibility**: The server middleware now gracefully handles requests that have already been processed by `express.json()` or other body parsers. By checking `req.body` instead of solely relying on `req.on('data')`, requests no longer hang indefinitely on consumed streams
- **Session ID type validation**: Enforced strict string validation (`typeof id === 'string'`) in `extractSessionId()`. This prevents type coercion bugs (e.g., `"[object Object]"`) if an attacker maliciously passes arrays via duplicate query parameters like `?session=1&session=2`
- **Performance: Dual redundant 100ms intervals merged into single 200ms interval** — both client and hybrid scripts had two separate `setInterval` timers each running at 100ms, both doing the same viewport + console detection work. Merged into one 200ms tick, reducing function call overhead by ~75% with no detection latency regression. The combined interval started at 250ms in initial implementation but was reduced to 200ms after testing confirmed Chrome's ring buffer reliability at shorter intervals
- **Critical hybrid sendBeacon regression**: session ID was dropped from `sendBeacon` fallback path during header migration — `sendBeacon` cannot send custom headers, so query param restoration was required for this code path
- **Shared `'anonymous'` session ID collision**: heartbeat and terminate handlers used `'anonymous'` as fallback session ID when none was provided — all anonymous sessions shared the same key, causing cross-session state corruption. Changed to `generateSessionId()` for unique per-session identification
- Hybrid client `fetch` calls no longer fail silently — all `.catch()` handlers now log errors via `console.warn` instead of empty function bodies
- `validateConfig()` no longer clobbers falsy-but-valid configuration values (e.g., `logLevel: ''`) — now uses `!= null` instead of `||` for default application
- Production guard now auto-generates a random 32-byte secret with a warning instead of crashing — more graceful, with a warning about multi-instance deployments
- `req.path` fallback (`|| req.url`) removed — Express 5.x always provides `req.path`; `req.url` in older Express included query strings which could break path matching
- Fragile unit test pattern simplified — default-secret test no longer guarded behind `createSession` existence check, removing conditional test execution
- **Critical Chrome/Mac false positive in `isMobile()`**: switched from `'ontouchstart' in global` (always `true` on Chrome/Mac due to Touch Bar event support) to `navigator.maxTouchPoints > 0` (only `true` on actual touch hardware). On Chrome/Mac, `isMobile()` was returning `true`, which disabled viewport detection entirely via `disableOnMobile` — meaning NO detection mechanism was active on Chrome/Mac
- Viewport thresholds adjusted: width 150px, height 170px — balanced to avoid extension sidebar false positives while reliably detecting DevTools
- Restored width-docked DevTools detection (was removed due to false positives from sidebar extensions at lower thresholds; 150px threshold avoids narrow extensions while catching all DevTools ≥200px)
- Height threshold set to 170px to safely clear Firefox power-user chrome (~165px max)

### Changed

- `blockInteractions` default changed from `true` to `false` — right-click blocking, text selection prevention, and drag protection are now opt-in. Sites behave more naturally unless explicitly configured
- `clearAllStorage()` gated behind `destructiveClear: true` — storage wiping on termination is now opt-in to prevent accidental data loss. A warning is logged when termination triggers but `destructiveClear` is `false`
- Session store migrated from plain objects to `createMemoryStore()` using `Map` — better dynamic key handling, built-in fingerprint and IP blocking, chunked cleanup (5,000 sessions per tick), and a clean store interface
- `validateConfig()` production guard changed from crashing to auto-generating a random secret with a warning — more graceful and preserves the running instance while alerting the operator
- Server middleware refactored from module-level singleton stores to instance-scoped stores with `instances[]` registry — each `createMiddleware()` call now has fully isolated session and termination stores, preventing cross-instance state leaks when running multiple server instances
- Server module exposed additional exports: `createSession`, `getSessionStore`, `getTerminatedSessions` — backward compatible, all existing call patterns continue to work

### Removed

- Legacy `__DEVTOLS_TERMINATOR_CONFIG__` and `__DEVTOLS_TERMINATOR_INITIALIZED__` fallback properties have been completely removed from client files to prevent accidental use of misspelled variables
- `SEC_DEVTOOLS_FORMAT_005` reason code (format probe function was already removed in an earlier iteration; constant was dead code)
- `console.clear()` removed from detection — was potentially interfering with Chrome's ring buffer processing
- Debugger timing detection removed entirely — caused false positives on Chromium-based browsers

For full version history, see `docs/CHANGELOG.md`.

---

## License

MIT License. Copyright (c) 2026 GimiRick.

See the [LICENSE](LICENSE) file for details.
