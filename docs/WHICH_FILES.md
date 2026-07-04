# File Reference

## Source Files (`src/`)

| File | Purpose |
|------|---------|
| `src/client/devtools-terminator.js` | Client-Only detection library. Include in any web page. |
| `src/client/devtools-terminator-hybrid.js` | Hybrid client library. Adds heartbeat and beacon support. |
| `src/server/devtools-terminator-server.js` | Express middleware for session validation and termination. |
| `src/cli/init.js` | CLI init script (`npx devtools-terminator init`). |

## Public Files (`public/`)

| File | Purpose |
|------|---------|
| `public/terminated.html` | The page users are redirected to upon detection. |

## Example Files (`examples/`)

| File | Purpose |
|------|---------|
| `examples/demo.html` | Runnable Client-Only demo. Open in a browser. |
| `examples/server-example.js` | Hybrid server demo. Requires Node.js. |
| `examples/usage-demo.js` | JavaScript usage patterns reference. |

## Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `docs/GETTING_STARTED.md` | Quick start guide for both modes. |
| `docs/HYBRID_SETUP.md` | Detailed Hybrid mode configuration. |
| `docs/WHICH_FILES.md` | This file — file reference. |
| `docs/SECURITY.md` | Security considerations and limitations. |
| `docs/CHANGELOG.md` | Version history. |
