# Changelog

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
