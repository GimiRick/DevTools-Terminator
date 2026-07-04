# Changelog

## [0.1.1] — 2026-07-05

### Added

- Per-IP rate limiting on heartbeat, terminate, and session endpoints
- Request body size limits to prevent OOM attacks (configurable, default 10KB)
- Structured JSON logging with level filtering (`error`/`warn`/`info`/`debug`) and custom logger support
- Server middleware configuration docs with all options documented
- Mac OS DevTools shortcut interception (`Cmd+Option+I/J/C`) via `e.altKey` check
- `fetch({ keepalive: true })` fallback for hybrid heartbeat and termination beacons when `navigator.sendBeacon` is unavailable

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
