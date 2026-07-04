# DevTools Terminator — Agent Build Specification

> **Confidentiality Notice:** This document describes the functional behavior and architecture of a proprietary browser security tool. No source code is included or may be reproduced. All implementation details are the intellectual property of the organization. This document is intended solely for internal AI-assisted development.

---

## 1. What This Tool Is

A lightweight, zero-dependency **JavaScript** browser security library. Its sole purpose is to detect when a user opens browser Developer Tools on a protected web page and immediately terminate their session, wiping all locally stored data, and redirecting them to a termination page.

The entire codebase — client, server, CLI, and examples — must be written in **JavaScript**. No TypeScript source files are used. The source files are consumed directly or copied as-is for distribution.

The tool exists in two operational modes:

- **Client-Only Mode** — runs entirely in the browser with no server requirement
- **Hybrid Mode** — pairs the browser component with a Node.js backend for cryptographically validated, server-enforced session security

---

## 2. Pure JavaScript Architecture

All source files must be JavaScript (`.js`). This applies to:

- The client-only detection library
- The hybrid client detection library
- The Express server middleware module
- The CLI init script
- All example files

No TypeScript compilation step is required. The source files are the distributable files.

### 2.1 Project Organization

The source files live in `src/` and are published directly. There is no build step — what you see in `src/` is what runs.

### 2.2 No Type System

The project does not use TypeScript. There are no type declaration files, no TypeScript compiler configuration, and no type-checking step. Configuration objects and API surfaces are documented in the README rather than enforced at compile time.

### 2.3 Distributable Output

The `src/` directory is what gets published to npm and served to end users. For Git Clone users, the files in `src/` are ready to use directly.

---

## 3. Dual Distribution Model

This tool must be built and structured to serve two distinct types of users simultaneously. Both user paths must be first-class citizens — neither should feel like an afterthought. Every file, folder name, entry point, and piece of documentation must be intentionally designed to work cleanly for both.

### 3.1 Git Clone Users

These users download the repository directly from GitHub using `git clone`. They want to inspect the JavaScript source, build the project themselves, run examples locally, and copy the files into their own project.

The project structure for Git Clone users must be:

- Clearly organized with self-explanatory folder names
- Accompanied by a comprehensive `README.md` with a dedicated Git Clone section
- Include runnable JavaScript example files (`examples/`) they can run directly
- Include a `public/` directory containing the pre-built `terminated.html` page
- Require only `npm install` to get dependencies — no build step needed
- The source in `src/` is ready to use immediately

### 3.2 npm Package Users

These users install the library via the npm registry using `npm install devtools-terminator`. They receive the files directly.

The package for npm users must:

- Define correct `main` and `exports` fields in `package.json` pointing to `src/` files
- Expose separate importable paths for the client library, server module
- Ship the pre-built `terminated.html` as part of the published package files so users can copy it to their public directory
- Include a CLI init command (`npx devtools-terminator init`) that automatically copies all required files (client JS, `terminated.html`) into the user's project directory
- Exclude development-only files (examples, raw docs, `.env.example`) from the published package using `.npmignore` — only `src/`, `public/terminated.html`, `README.md`, and `LICENSE` are published

---

## 4. Project File Structure

The agent must produce a file structure that satisfies both distribution paths described above. The structure must be:

```text
devtools-terminator/
├── src/
│   ├── client/
│   │   ├── devtools-terminator.js         (Client-Only library)
│   │   └── devtools-terminator-hybrid.js  (Hybrid client library)
│   ├── server/
│   │   └── devtools-terminator-server.js  (Express middleware)
│   └── cli/
│       └── init.js                        (CLI init script)
 ├── public/
│   └── terminated.html                    (PROVIDED BY TEAM — do not generate)
├── examples/
│   ├── demo.html                          (Client-Only demo for Git Clone users)
│   ├── server-example.js                  (Hybrid server demo)
│   └── usage-demo.js                      (JavaScript usage patterns demo)
├── docs/
│   ├── GETTING_STARTED.md
│   ├── HYBRID_SETUP.md
│   ├── WHICH_FILES.md
│   ├── SECURITY.md
│   └── CHANGELOG.md
├── .env.example
├── .gitignore
├── .npmignore
├── package.json
├── README.md
└── LICENSE
```

---

## 5. Operational Modes

### 5.1 Client-Only Mode

Designed for static websites, demos, and frontends without a backend. All detection and termination logic runs inside the browser. A determined attacker with proxy tools could theoretically block the script from loading, but for casual and intermediate-level inspection this mode is highly effective.

### 5.2 Hybrid Mode

Designed for production applications with a Node.js/Express backend. The browser component sends cryptographically signed proof-of-life signals (heartbeats) to the server. If those heartbeats stop, or if DevTools are detected, the server is notified and immediately locks the session out of all protected API routes. This mode is significantly harder to bypass.

---

## 6. Detection Methods

The tool must implement three independent detection mechanisms that run simultaneously:

### 6.1 Console Object Property Getter

A specially crafted object is created in memory with a property whose getter function fires silently when the browser's DevTools console reads and evaluates it. Under normal conditions (DevTools closed) this getter is never called. The moment a user opens their console, the browser evaluates the object, triggering the getter and initiating termination.

This is the primary and most reliable detection method.

### 6.2 Viewport Dimension Differential

When DevTools are docked to the side or bottom of the browser window, the visible page area (inner dimensions) shrinks while the overall browser window size (outer dimensions) stays the same. The tool continuously measures the difference between these two values. When the gap exceeds a defined pixel threshold, it signals that a panel has been attached — indicating DevTools.

This check must be automatically skipped on mobile devices to avoid false positives caused by virtual keyboards and browser address bars resizing the viewport.

### 6.3 Debugger Statement Timing

A `debugger` statement, when evaluated in a browser with DevTools closed, executes and resolves in under a millisecond. When DevTools are open and the Sources panel is active, the same statement causes a measurable pause. The tool times this execution and flags it as a detection event if the pause exceeds a defined millisecond threshold.

This runs at a lower frequency than the other two checks to conserve CPU.

---

## 7. Keyboard and UI Protection

Independently of detection, the tool must intercept and neutralize all common pathways a user might use to open DevTools:

- **Keyboard shortcuts blocked:** F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, and their macOS equivalents (Cmd+Option+I, Cmd+Option+J, Cmd+Option+U)
- **Right-click context menu:** Disabled entirely to prevent "Inspect Element"
- **Text drag-and-drop:** Disabled to prevent users dragging code snippets out
- **Text selection:** Blocked globally across the page, with a deliberate exception for standard user input elements (text fields, textareas, content-editable regions) so legitimate user interactions are not broken

---

## 8. Session Termination Sequence

When any detection method fires, the following must happen in strict order:

1. An internal atomic flag is set to prevent the termination sequence from running more than once
2. All active polling intervals are cleared to stop further checks and prevent memory leaks
3. Any user-defined callback function is executed (allows custom logging or analytics)
4. In Hybrid Mode: a termination signal is dispatched to the server via the browser's Beacon API (fire-and-forget, survives page unload)
5. All local browser storage is wiped:
   - `localStorage`
   - `sessionStorage`
   - All cookies (cleared across root path, domain, and subdomain variants)
   - All `IndexedDB` databases
   - All `CacheStorage` entries
   - All registered Service Workers are unregistered
6. The browser is redirected to the termination page using a replace-style navigation that removes the protected page from browser history (preventing the back button from returning to it)

---

## 9. Mobile Device Handling

The tool must reliably detect mobile environments to suppress checks that produce false positives on phones and tablets. Detection must cover:

- iOS devices (iPhone, iPod, standard iPad)
- iPadOS (which identifies itself as macOS but has multi-touch support)
- Android devices and other mobile user agents
- Any device with a screen width below a defined small-screen threshold

When a mobile device is detected, the viewport size differential check is disabled. Keyboard and console checks may remain active.

---

## 10. Hybrid Mode — Cryptographic Heartbeat System

This is the core of the Hybrid architecture. The browser component must periodically prove to the server that it is alive, unmodified, and running in an untampered environment.

### 10.1 Browser Fingerprint

On each heartbeat, the client generates a fingerprint by combining:

- The browser's user agent string
- Screen width and height
- The user's timezone

This combined string is hashed using SHA-256 to produce a stable, anonymous identifier for the session environment.

### 10.2 Script Integrity Hash

The client locates its own script tag in the DOM, fetches its own source code, and computes a SHA-256 hash of that content. This hash is included in the heartbeat payload. The server can use this to detect if the script has been tampered with or substituted.

### 10.3 HMAC-SHA256 Signed Payload

The heartbeat payload is structured as:

```text
fingerprint : scriptHash : currentTimestamp
```

This string is signed using HMAC-SHA256 with a shared secret key known only to the client configuration and the server. The resulting signature travels alongside the payload.

### 10.4 Heartbeat Transmission

Heartbeats are sent to the server every 30 seconds. The server considers a session stale if no heartbeat is received within 45 seconds. This 15-second grace window accommodates normal network latency.

### 10.5 Termination Beacon

When DevTools are detected, a termination event is sent to the server using the browser's `navigator.sendBeacon` API. This method is specifically chosen because it continues to execute even as the page is being unloaded or redirected, ensuring the server receives the notification regardless of timing.

---

## 11. Server Component Behavior

The server module integrates as Express middleware and is responsible for:

### 11.1 Session Tracking

An in-memory store tracks the state of every active session. Each entry records:

- Timestamp of the last valid heartbeat
- Whether the session has been terminated
- The browser fingerprint from the last heartbeat
- The script integrity hash from the last heartbeat

### 11.2 Heartbeat Validation

When a heartbeat arrives, the server must:

1. Verify the HMAC-SHA256 signature matches what it would produce with the same shared secret
2. Use a timing-safe byte comparison when checking signatures (prevents timing-based attacks)
3. Verify the timestamp in the payload is within the configured replay-attack window (e.g., 10 seconds) — payloads older than this are rejected to prevent replay attacks
4. Update the session's last-seen timestamp if all checks pass

### 11.3 Route Protection

For every incoming request to non-API routes, the middleware checks whether the requesting session has been marked as terminated. If it has, the request is immediately rejected with an HTTP 403 response. The user cannot access any protected endpoint.

### 11.4 Termination Handling

When a termination beacon arrives from the client, the server marks the session as terminated in the store, logs a security audit event (timestamp, session ID, reason code, IP address), and fires any configured server-side callback for custom alerting (webhooks, Slack, database logging, etc.).

### 11.5 Memory Management

To prevent the in-memory session store from growing unbounded, a background cleanup routine runs periodically and removes entries for sessions that have been inactive beyond a defined staleness threshold.

### 11.6 Production Safety Guard

If the server detects it is running in a production environment but the shared secret has not been changed from the default placeholder value, it must throw a hard error at startup and refuse to run. This prevents accidental insecure deployments.

---

## 12. CLI Init Command (npm Users Only)

The package must ship a CLI script invokable via `npx devtools-terminator init`. The source for this script lives at `src/cli/init.js`. When run inside a user's project directory, it must:

1. Detect whether the user wants Client-Only or Hybrid setup (prompt or flag)
2. Copy the appropriate client JS file from the package into the user's project (e.g., into a `public/` or `assets/` directory)
3. Copy the pre-built `terminated.html` into the user's public directory
4. Print a clear success message showing exactly which files were copied and where
5. Print the next steps the user needs to take (adding the script tag, configuring the server, etc.)

The init command must never overwrite existing files without asking the user for confirmation first.

---

## 13. Termination Page

> **Note for the agent:** The `terminated.html` file will be provided to you directly by the team. **Do not generate this file.** Place it as-is at `public/terminated.html` in the project output. The termination page is proprietary and pre-built — your only responsibility is to ensure the rest of the tool points to its correct path.

For npm users, this file must be included in the published package and copied into the user's project by the CLI init command. For Git Clone users, it already exists in the `public/` directory of the cloned repository.

---

## 14. NoScript Handling

The tool must account for users who have JavaScript disabled entirely. A companion HTML snippet must be provided that, when included in any protected page, immediately redirects to the termination page if the browser has JavaScript disabled.

---

## 15. Configuration System

The tool must be configurable without modifying the source. Configuration is supplied by defining a global object on the `window` before the compiled script loads. All options must have sensible, secure defaults.

Required configuration options:

| Option | Type | Description |
| --- | --- | --- |
| Termination URL | `string` | Where to redirect the user on detection |
| Check interval | `number` | How frequently (in ms) the detection loop polls |
| Window size check toggle | `boolean` | Enable or disable the viewport differential check |
| Keyboard block toggle | `boolean` | Enable or disable shortcut interception |
| Mobile disable toggle | `boolean` | Automatically suppress checks on mobile devices |
| Custom callback | `function` | A function to execute at the moment of detection |
| Server validation toggle | `boolean` | (Hybrid) Enable or disable heartbeat sending |
| API endpoint | `string` | (Hybrid) The server URL for heartbeats and termination events |
| Shared secret | `string` | (Hybrid) The HMAC key matching the server configuration |

The configuration object must be frozen after initialization so nothing can modify it at runtime.

---

## 16. Public API

The tool must expose a minimal, read-only public API on the browser global scope:

| API Member | Type | Description |
| --- | --- | --- |
| `version` | `string` | The current library version |
| `isTerminated()` | `function` | Returns whether the session is currently terminated |
| `terminate()` | `function` | Manually triggers the full termination sequence |
| `config` | `object` | Read-only reference to the active configuration |

---

## 17. README Requirements

The `README.md` generated by the agent must be comprehensive, well-structured, and written for a developer audience. It is the primary documentation for both user types and must leave no ambiguity about how to get started, configure, or integrate the library.

The README must contain the following sections in this order:

### 17.1 Header Section

- Project name and one-line description
- Version badge, license badge, and npm badge
- A brief paragraph explaining what the tool does and why it exists
- A note that the entire library is written in JavaScript

### 17.2 Table of Contents

A full, linked table of contents covering every section in the document.

### 17.3 About

A dedicated "About" section must appear immediately after the Table of Contents. It must contain exactly the following text:

> Part of the **GimiRick** toolchain. We build open source LLMs and AI systems. Founded by Mohammad Faiz.

This section must be short — no padding, no extra sentences added around it. Just the statement above, presented clearly.

### 17.4 Features Overview

A concise list of all major features split by mode: Client-Only features and Hybrid Mode features. Each feature should be one line with a clear description.

### 17.5 Which Version Should I Use?

A short decision guide helping the user pick between Client-Only and Hybrid based on their use case (static site vs. Node.js backend, low-security vs. high-security requirements).

### 17.6 — Git Clone Users — (Dedicated Section)

This section is exclusively for users who obtain the library via `git clone`. It must cover:

- Prerequisites (Node.js version requirement)
- Step-by-step cloning instructions
- How to install dependencies (`npm install`)
- Explanation of the repository file structure with a brief description of every folder and key file
- How to run the Client-Only demo locally (starting a local HTTP server and opening `examples/demo.html`)
- How to run the Hybrid server demo locally (setting up `.env`, running the server)
- How to manually copy the files from `src/` into their own project for Client-Only setup
- How to manually copy the files from `src/` into their own project for Hybrid setup

### 17.7 — npm Users — (Dedicated Section)

This section is exclusively for users who install the library via npm. It must cover:

- Installation command
- How to use the CLI init command (`npx devtools-terminator init`) with a full description of what it does step by step
- How to load the client library via a script tag after npm install (path inside `node_modules/devtools-terminator/src/client/`)
- How to import the client library via a bundler (Vite, Webpack)
- How to import the server module in a Node.js/Express application
- How to configure environment variables (`.env` setup, generating a strong secret)
- What files are included in the published package and what is excluded

### 17.8 Configuration Reference

A complete table of all configuration options with name, expected type, default value, and description. Must cover both Client-Only and Hybrid options, clearly labeled.

### 17.9 How It Works

A technical explanation of each detection method, the termination sequence, and (for Hybrid) the cryptographic heartbeat system. Written in plain English, no code.

### 17.10 Public API Reference

A table of all public API members with description.

### 17.11 Browser Compatibility

A table of supported browsers with minimum version, supported platforms, and support status. Include the note about Chrome Desktop limitations.

### 17.12 Security Considerations

An honest explanation of what the tool does and does not protect against. Must include the philosophy statement: this is a deterrent layer, not a replacement for server-side security.

### 17.13 Contributing

Brief contribution guidelines with a link to `docs/CONTRIBUTING.md`. Note that all contributions must be in JavaScript.

### 17.14 Changelog

Summary of the latest version changes with a link to `docs/CHANGELOG.md` for full history.

### 17.15 License

License name, copyright holder, and link to the `LICENSE` file.

---

## 18. package.json Requirements

The `package.json` must be correctly configured for npm publishing. Required fields:

- `name` — the package name as it will appear on npm
- `version` — current semantic version
- `description` — one-line description
- `main` — points to `src/client/devtools-terminator.js` (the default entry for generic consumers)
- `browser` — points to `src/client/devtools-terminator.js` (signals to bundlers this is a browser-first package)
- `exports` — defines named subpath exports:
  - `.` — the client-only library (`src/client/devtools-terminator.js`)
  - `./client` — explicit client-only library path
  - `./hybrid` — the hybrid client library (`src/client/devtools-terminator-hybrid.js`)
  - `./server` — the Express server middleware (`src/server/devtools-terminator-server.js`)
- `bin` — defines the `devtools-terminator` CLI command pointing to `src/cli/init.js`
- `files` — explicitly lists only the files to include in the published package: `src/`, `public/terminated.html`, `README.md`, `LICENSE`
- `engines` — specifies minimum Node.js version
- `dependencies` — Express and session-related packages required for Hybrid server usage
- `license` — set to `"MIT"`

---

## 19. Browser Compatibility Requirements

The tool must function correctly across:

- Firefox 88+
- Safari 14+ (macOS and iOS)
- Microsoft Edge 90+
- Opera 76+
- All Chromium-based browsers (Brave, Vivaldi, Arc, etc.)
- Chrome Mobile on Android

**Note on Chrome Desktop:** Due to Chrome's highly optimized DevTools, certain detection methods may behave differently on Windows and macOS. Chrome on Linux is not a guaranteed target. Prioritize Firefox, Safari, and Edge as primary test targets.

---

## 20. Technical Constraints

- **JavaScript source only** — all source files must be `.js`; no TypeScript files are permitted
- **Zero runtime dependencies for client** — no npm packages, no CDN links, no external resources of any kind in the client library
- **CSP compatible** — must not use `eval`, `new Function()`, or inline event handlers that would violate a strict Content Security Policy
- **Small footprint** — client library should remain under 15KB
- **No stray console output** — no `console.log` or debug output (except intentional decoy logs used as part of the detection mechanism)

---

## 21. Reason Codes

Each termination event must be tagged with a machine-readable reason code for audit and analytics purposes. These codes must be defined as constants in `src/cli/init.js` or a shared config. Required codes:

| Code | Trigger |
| --- | --- |
| `SEC_DEVTOOLS_CONSOLE_001` | Console object getter fired |
| `SEC_DEVTOOLS_DEBUGGER_002` | Debugger timing threshold exceeded |
| `SEC_DEVTOOLS_SIZE_003` | Viewport size differential exceeded |
| `SEC_DEVTOOLS_KEY_004` | DevTools keyboard shortcut intercepted |
| `SEC_DEVTOOLS_MANUAL` | Programmatic `.terminate()` call |
| `SEC_DEVTOOLS_UNKNOWN` | Unclassified detection |
| `SEC_DEVTOOLS_INVALID_SIG` | (Server) Invalid HMAC signature received |

---

## 22. License

This library is released under the **MIT License**. The agent must:

- Include a `LICENSE` file in the project root containing the full MIT License text, with the copyright year and the author name filled in correctly
- Include the license name in `package.json` under the `"license"` field as `"MIT"`
- Reference the MIT License in the `README.md` license section with a link to the `LICENSE` file

The MIT License permits users to use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software, provided the original copyright notice and license text are preserved. This applies to both the Git Clone and npm distribution paths.

---

*This specification is confidential and proprietary. Unauthorized reproduction or distribution is prohibited.*
