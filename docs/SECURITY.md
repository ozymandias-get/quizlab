# Security Policy

## Supported Versions

We actively support and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow the responsible disclosure process below.

### How to Report

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, report via:

📧 **Email**: [Create a security advisory on GitHub](https://github.com/ozymandias-get/quizlab/security/advisories/new)

Or contact the maintainer directly through GitHub.

### What to Include

When reporting a vulnerability, please provide:

- **Description**: Clear description of the vulnerability
- **Impact**: What could be compromised or affected
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions are impacted
- **Mitigation**: Any suggested fixes or workarounds (optional)
- **Proof of Concept**: If applicable, include a minimal PoC

### Response Timeline

| Phase | Timeline |
|-------|----------|
| Acknowledgment | Within 48 hours |
| Initial Assessment | Within 5 business days |
| Fix Development | Depends on severity |
| Public Disclosure | After fix is released |

### Severity Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| Critical | Remote code execution, data breach | 24-48 hours |
| High | Privilege escalation, major feature compromise | 1 week |
| Medium | Limited impact vulnerabilities | 2-4 weeks |
| Low | Minor issues, defense in depth | Next release |

## Security Best Practices

### For Users

- Always use the latest version of QuizLab Reader
- Download only from official GitHub releases
- Keep your API keys and credentials secure
- Report suspicious behavior immediately

### For Contributors

- Never commit secrets, API keys, or credentials
- Follow secure coding practices
- Validate all IPC inputs
- Use contextBridge for API exposure (no direct Node.js access in renderer)
- Sanitize HTML content (DOMPurify is used)

## Security Features

QuizLab implements several security measures:

- **Context Isolation**: Enabled via preload script
- **No Node.js in Renderer**: All Node APIs accessed via IPC
- **Custom Protocol**: PDFs served via `pdfstream://` protocol
- **CSP**: Content Security Policy configured
- **External Links**: Opened via `shell.openExternal()`

## Disclosure Policy

When we receive a security report:

1. We confirm receipt and begin investigation
2. We develop and test a fix
3. We release the fix in a new version
4. We publicly disclose the issue (with credit to the reporter, if desired)

## Acknowledgments

We thank the following security researchers who have responsibly disclosed vulnerabilities:

*No vulnerabilities reported yet.*

---

Last updated: 2026-02-25
