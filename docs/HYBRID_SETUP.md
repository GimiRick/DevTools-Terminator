# Hybrid Mode Setup

Hybrid mode adds server-enforced session security to the DevTools Terminator. The browser sends cryptographically signed heartbeats to your Express server. If heartbeats stop or DevTools are detected, the server locks the session out.

## Architecture

```
Browser                          Server
  |                                |
  |-- heartbeat (every 30s) ------>|  HMAC-SHA256 signed payload
  |                                |  Validates signature, timestamp
  |<-- status: ok -----------------|
  |                                |
  |-- [DevTools detected]          |
  |-- terminate beacon ----------->|  Fire-and-forget via fetch keepalive (with sendBeacon fallback)
  |                                |  Marks session as terminated
  |                                |
  |-- request to /api/protected -->|  403 FORBIDDEN (session dead)
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

```
DEVTOOLS_SECRET=your-generated-64-char-hex-string
PORT=3000
NODE_ENV=development
```

## Security Notes

- The shared secret must match on both client and server.
- If the default secret is detected, the server auto-generates a random 32-byte secret with a warning. Always configure a unique `sharedSecret` for production.
- Use HTTPS in production to prevent secret exposure.
