# Changelog

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
- Viewport detection interval reduced from 1000ms to 100ms for near-instant response (later merged with duplicate console timer to 200ms — see Fixed section)
- Viewport delta tracking with outer dimension stability check (catches mid-session docking)
- `DevToolsTerminator._status()` diagnostic method — returns current viewport dimensions, `isMobile`, `windowSizeCheck` state and other debug info
- Repeated `console.log(obj)` keeps a live entry in Chrome's ring buffer (was once during init; the single entry could be evicted before DevTools opens; runs at 200ms after merging with viewport timer — see Fixed section)

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

## [0.1.1] — 2026-07-05

### Added (0.1.1)

- Per-IP rate limiting on heartbeat, terminate, and session endpoints
- Request body size limits to prevent OOM attacks (configurable, default 10KB)
- Structured JSON logging with level filtering (`error`/`warn`/`info`/`debug`) and custom logger support
- Server middleware configuration docs with all options documented
- Mac OS DevTools shortcut interception (`Cmd+Option+I/J/C`) via `e.altKey` check
- `navigator.sendBeacon` fallback for hybrid heartbeat and termination beacons when `fetch` is unavailable; `fetch({ keepalive: true })` preferred

### Fixed

- Server middleware `config`/`logger` no longer shared across middleware instances — each `createMiddleware()` call now has isolated configuration
- `terminatedSessions` store no longer leaks memory — entries now cleaned up when stale
- Client `debuggerDetection()` no longer throws `ReferenceError` when `performance` global is unavailable
- Rate limiter internal bucket cache no longer leaks memory — periodic cleanup of expired entries
- Request body accumulation stops immediately after exceeding `maxBodySize`, preventing memory waste
- CLI `--dir` flag no longer interprets the next flag as a directory path
- `timingSafeEqual` no longer crashes on invalid hex signatures — wrapped in try/catch with buffer length validation
- Oversized payloads now destroy the socket (`req.destroy()`) to prevent resource exhaustion attacks
- F12 keycode corrected from `112` (F1) to `123` (F12) in both client files
- Subdomain cookie deletion logic reworked to correctly target all parent domain levels, including naked domains
- Hybrid `sendTerminationBeacon()` now returns a `Promise` so the termination sequence can await beacon delivery before navigating
- Hybrid termination race condition fixed — navigation waits for beacon delivery with a 500ms safety timeout
- Async storage wipe race condition fixed — `location.replace()` now fires after a 100ms delay so IndexedDB, CacheStorage, and ServiceWorker deletions complete before page navigation
- `document.domain` usage replaced with `window.location.hostname` for modern browser compatibility
- `__DEVTOLS_TERMINATOR_CONFIG__` typo fixed in CLI output, documentation, and example files while preserving backward-compatible fallback in client code
- Configuration variable now primarily reads `__DEVTOOLS_TERMINATOR_CONFIG__` (correct spelling) with `__DEVTOLS_TERMINATOR_CONFIG__` kept as a backward-compatible fallback
- Initialization guard now checks both `__DEVTOOLS_TERMINATOR_INITIALIZED__` (correct) and `__DEVTOLS_TERMINATOR_INITIALIZED__` (legacy fallback)
- Environment variable name in server production error message corrected from `DEVTOLS_SECRET` to `DEVTOOLS_SECRET`
- Unused `vm` module import removed from unit tests

## [0.1.0] — 2026-07-04

### Added (0.1.0)

- Client-Only detection mode with three independent detection mechanisms:
  - Console object property getter
  - Viewport dimension differential
  - Debugger statement timing
- Hybrid mode with HMAC-SHA256 cryptographic heartbeat system
- Keyboard shortcut interception (F12, Ctrl+Shift+I/J/C, Ctrl+U)
- Right-click context menu blocking
- Text drag-and-drop and selection prevention
- Global storage wipe (localStorage, sessionStorage, cookies, IndexedDB, CacheStorage)
- Service Worker unregistration on termination
- Mobile device detection and automatic check suppression
- Configuration via global window object (frozen after init)
- Public API: `version`, `isTerminated()`, `terminate()`, `config`
- Express server middleware for session validation
- In-memory session store with automatic cleanup
- CLI init command (`npx devtools-terminator init`)
- NoScript fallback support
- MIT License
