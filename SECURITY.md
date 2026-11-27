# Security Policy

## Privacy Guarantee

**Typewriter** is an offline-first Android Input Method Service (`InputMethodService`).
- Keystrokes, typed text, learned dictionary words, and clipboard history are processed strictly on-device.
- No telemetry, analytics, or keystroke data is transmitted over the network.

## Supported Versions

| Component | Version | Supported |
| --- | --- | --- |
| `app/` (Android IME) | `1.0.x` | Yes |
| `web/` (3D Showcase) | `1.0.x` | Yes |

## Reporting a Vulnerability

If you discover a security or privacy issue in either `app/` or `web/`:
1. **Do not** open a public GitHub issue with exploit details.
2. Report it privately using GitHub's **Security Advisories** (`Security → Advisories → Report a vulnerability`) on `https://github.com/The-habib/Typewriter/security/advisories/new`.
3. Include steps to reproduce, affected component (`app/` or `web/`), and potential impact. We will acknowledge reports promptly and coordinate a fix before public disclosure.
