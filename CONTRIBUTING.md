# Contributing to DevTools Terminator

Thank you for considering contributing. All contributions must be in **JavaScript** — no TypeScript source files are accepted.

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Commit with a clear, descriptive message
5. Push to your fork (`git push origin feature/your-feature`)
6. Submit a pull request

## Development Setup

```bash
git clone https://github.com/GimiRick/DevTools-Terminator.git
cd DevTools-Terminator
npm install
```

## Code Style

- **JavaScript only** — no TypeScript
- **No transpilers** — the code runs directly in browsers and Node.js 20+
- **No runtime dependencies** — the client library must remain dependency-free
- **CSP compatible** — no `eval`, no `new Function()`, no inline event handlers
- **ES5 compatible** — the client library targets older browsers where possible
- Use `var` over `let`/`const` for client code (ES5 compatibility)
- Use descriptive variable names
- Avoid comments in production code — the code should be self-documenting

## Project Structure

```
src/
├── client/
│   ├── devtools-terminator.js            # Client-Only library
│   └── devtools-terminator-hybrid.js     # Hybrid client library
├── server/
│   └── devtools-terminator-server.js     # Express middleware
└── cli/
    └── init.js                           # CLI init script
```

## Testing

Currently there is no automated test suite. Manual testing is performed by:

1. Running the demo pages in `examples/`
2. Opening DevTools in supported browsers (Chrome, Firefox, Safari, Edge, Opera)
3. Verifying the termination sequence fires correctly
4. Verifying no false positives occur during normal browsing

Adding tests is a welcome contribution.

## Pull Request Checklist

- [ ] Code follows the project's style and conventions
- [ ] Changes are JavaScript-only (no TypeScript)
- [ ] Client code has no new runtime dependencies
- [ ] No eval, new Function, or inline event handlers introduced
- [ ] No sensitive data (secrets, keys) committed
- [ ] Commit messages are clear and descriptive

## Questions

Open a [GitHub Discussion](https://github.com/GimiRick/DevTools-Terminator/discussions) for questions, ideas, or proposals before writing code.
