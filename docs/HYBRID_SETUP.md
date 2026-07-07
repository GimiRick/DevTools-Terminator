# Hybrid Mode Setup

Hybrid mode adds server-enforced session security to the DevTools Terminator. The browser sends cryptographically signed heartbeats to your Express server. If heartbeats stop or DevTools are detected, the server locks the session out.

## Architecture

```text
Browser                          Server
  |                                |
  |-- heartbeat (every 30s) ------>|  HMAC-SHA256 signed payload
  |                                |  Validates signature, timestamp
  |<-- status: ok -----------------|
  |                                |
  |-- [DevTools detected]          |
  |-- terminate beacon ----------->|  Fire-and-forget via fetch keepalive (with sendBeacon fallback)
  |                                |  Marks session as terminated
  |                                |  Blocks fingerprint + IP
  |                                |
  |-- [bypass attempt: new session]|
  |-- request to /api/protected -->|  403 FORBIDDEN (fingerprint/IP blocked)
```

## Server Setup

```javascript
const express = require('express');
const devtoolsMiddleware = require('devtools-terminator/server');

const app = express();

const middleware = devtoolsMiddleware({
  sharedSecret: process.env.DEVTOOLS_SECRET,
  onTermination: (data) => {
    // Log to database, send webhook, etc.
    console.log('Terminated:', data.sessionId);
  },
  onHeartbeat: (data) => {
    // Optional: log heartbeat events
  }
});

app.use('/api/devtools', middleware);
```

## Client Setup

```html
<script>
  window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
    hybridMode: true,
    serverEndpoint: '/api/devtools',
    sharedSecret: 'your-shared-secret-key',
    terminationURL: '/terminated.html'
  };
</script>
<script src="path/to/devtools-terminator-hybrid.js" data-devtools-terminator></script>
```

## Generating a Strong Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Environment Variables

Create a `.env` file:

```bash
DEVTOOLS_SECRET=your-generated-64-char-hex-string
PORT=3000
NODE_ENV=development
```

## Security Notes

- The shared secret must match on both client and server.
- If the default secret is detected, the server auto-generates a random 32-byte secret with a warning. Always configure a unique `sharedSecret` for production.
- Use HTTPS in production to prevent secret exposure.
- When a session is terminated, the server blocks both the originating **browser fingerprint** (SHA-256 hash of UA + screen + timezone) and **IP address**. This prevents bypass by requesting a new session ID from the same device or network.
- The server uses `Map` and `Object.create(null)` for all internal stores, providing inherent protection against prototype pollution via crafted session IDs or IPs.
