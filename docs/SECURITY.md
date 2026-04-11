# Security Policy

## Supported Versions

We actively support and provide security updates for the following versions:

| Version | Supported |
| ------- | --------- |
| 3.0.x   | Yes       |
| 2.x.x   | No        |
| 1.x.x   | No        |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow responsible disclosure.

### How to Report

Do **not** open a public GitHub issue for security vulnerabilities.

Report via GitHub Security Advisory:

- https://github.com/ozymandias-get/quizlab/security/advisories/new

Or contact the maintainer directly through GitHub.

### What to Include

When reporting a vulnerability, please provide:

- Description: clear explanation of the issue
- Impact: what could be compromised
- Steps to reproduce
- Affected versions
- Suggested mitigation (optional)
- Minimal proof of concept (if applicable)

### Response Timeline

| Phase              | Timeline               |
| ------------------ | ---------------------- |
| Acknowledgment     | Within 48 hours        |
| Initial Assessment | Within 5 business days |
| Fix Development    | Depends on severity    |
| Public Disclosure  | After fix is released  |

## Security Best Practices

### For Users

- Use the latest release
- Download only from official GitHub releases
- Keep API keys and credentials secure
- Report suspicious behavior immediately

### For Contributors

- Never commit secrets or credentials
- Validate all IPC inputs
- Keep `shared/` (`@shared-core/*`) platform-agnostic
- Keep renderer-only logic in `src/` (`@shared/*`)
- Keep Node.js APIs out of renderer; use preload/IPC bridge

## Security Features in This Repo

- Context isolation via preload script
- No direct Node.js access in renderer
- Custom `local-pdf://` protocol for PDF loading
- Content Security Policy configuration
- External links opened via `shell.openExternal()`

## Disclosure Policy

When we receive a security report:

1. We confirm receipt and begin investigation.
2. We develop and test a fix.
3. We release the fix in a new version.
4. We disclose the issue publicly (with credit if desired).

---

Last updated: 2026-04-11
