# Changelog

## [0.1.1] — 2026-07-05

### Added
- Per-IP rate limiting on heartbeat, terminate, and session endpoints
- Request body size limits to prevent OOM attacks (configurable, default 10KB)
- Structured JSON logging with level filtering (`error`/`warn`/`info`/`debug`) and custom logger support
- Server middleware configuration docs with all options documented

### Fixed
- Server middleware `config`/`logger` no longer shared across middleware instances — each `createMiddleware()` call now has isolated configuration
- `terminatedSessions` store no longer leaks memory — entries now cleaned up when stale
- Client `debuggerDetection()` no longer throws `ReferenceError` when `performance` global is unavailable
- Rate limiter internal bucket cache no longer leaks memory — periodic cleanup of expired entries
- Request body accumulation stops immediately after exceeding `maxBodySize`, preventing memory waste
- CLI `--dir` flag no longer interprets the next flag as a directory path

## [0.1.0] — 2026-07-04

### Added
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
