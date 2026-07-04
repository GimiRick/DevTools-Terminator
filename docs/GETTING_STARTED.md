# Getting Started with DevTools Terminator

## Prerequisites

- Node.js 20+ (for npm installation and Hybrid mode)
- A web server (for Client-Only mode, any static server works)

## Quick Start — Client-Only

1. Include the script on your page:

```html
<script src="path/to/devtools-terminator.js"></script>
```

2. Configure before the script loads:

```html
<script>
  window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
    terminationURL: '/terminated.html'
  };
</script>
<script src="path/to/devtools-terminator.js"></script>
```

3. Place `terminated.html` in your public directory.

That's it. The script will automatically start protecting the page.

## Quick Start — Hybrid Mode

1. Install the package:

```bash
npm install devtools-terminator
```

2. Set up your Express server with the middleware:

```javascript
const devtoolsMiddleware = require('devtools-terminator/server');

app.use('/api/devtools', devtoolsMiddleware({
  sharedSecret: process.env.DEVTOLS_SECRET
}));
```

3. Include the hybrid client on your page with the matching config.

## What's Next?

- See `examples/demo.html` for a working Client-Only demo
- See `examples/server-example.js` for a Hybrid server demo
- Read `WHICH_FILES.md` to understand what each file does
- Read `HYBRID_SETUP.md` for detailed Hybrid configuration
