# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in DevTools Terminator, please do **not** open a public issue. Instead, send a private report to the repository maintainer via GitHub's private vulnerability reporting system.

To report a vulnerability:

1. Go to the repository's **Security** tab
2. Click **Report a vulnerability**
3. Provide a detailed description, reproduction steps, and impact assessment

You should receive a response within **48 hours**. If you do not, please follow up via the repository's issue tracker referencing your initial report.

## What to Include

- A clear description of the vulnerability
- Steps to reproduce (proof of concept is helpful)
- The version(s) affected
- Potential impact and any suggested mitigation

## Scope

The following are in scope:

- The client detection libraries (`devtools-terminator.js`, `devtools-terminator-hybrid.js`)
- The server middleware (`devtools-terminator-server.js`)
- The CLI init script (`init.js`)

The following are out of scope:

- Browser extensions that modify page content
- Proxy-based traffic interception
- Physical access attacks
- Social engineering attacks

## Disclosure Policy

We follow a **coordinated disclosure** process:

1. The report is acknowledged within 48 hours
2. A fix is developed and tested
3. The fix is released, and the vulnerability is publicly disclosed

We ask that reporters wait **90 days** after the fix is released before publishing any details.

## Security Considerations

For a full discussion of the security model, attack surface, and recommended hardening, see [`docs/SECURITY.md`](docs/SECURITY.md).

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |
