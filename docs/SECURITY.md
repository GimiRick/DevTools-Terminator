# Security Considerations

## Philosophy

DevTools Terminator is a **deterrent layer**, not a replacement for server-side security. It raises the bar against casual and intermediate inspection but cannot stop a determined attacker with full control over their machine.

## What It Protects Against

- Casual users pressing F12 or right-clicking to inspect
- Users opening the browser console out of curiosity
- Automated scrapers that rely on DevTools APIs
- Session hijacking via local storage inspection

## What It Does NOT Protect Against

- A user who disables JavaScript entirely (mitigated by noscript fallback)
- A user who modifies the script before it loads (mitigated by hybrid script integrity check)
- A user who patches the browser executable to remove DevTools restrictions
- Proxy-based traffic interception and modification
- Physical access attacks (keyloggers, screen recording)
- Browser extensions that modify page content
- Browsers with built-in fingerprinting protection that spoofs window dimension APIs (e.g., Brave Shields)

## Defense in Depth

For production applications, combine this tool with:

1. **Server-side authentication** — JWT, session tokens, OAuth
2. **Content Security Policy** — restrict script sources, disable eval
3. **Subresource Integrity** — ensure the library has not been tampered with
4. **Rate limiting** — prevent brute-force attacks
5. **HTTPS** — prevent man-in-the-middle attacks
6. **Backend authorization** — never trust the client

## Hybrid Mode Security

The HMAC-SHA256 heartbeat system provides:

- **Replay protection** — timestamps prevent payload reuse
- **Tamper detection** — script integrity hash catches modifications
- **Session binding** — fingerprint ties the session to a specific browser
- **Server enforcement** — terminated sessions cannot access protected routes

However, the shared secret is embedded in the client configuration. A determined attacker can extract it. Use Hybrid mode as a hardening layer, not a silver bullet.
