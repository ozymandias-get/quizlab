# Contributing to Quizlab Reader

Thank you for your interest in contributing. This guide reflects the current repository layout and workflow.

## Table of Contents

- [Development Setup](#development-setup)
- [Branch Strategy](#branch-strategy)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Checklist](#pull-request-checklist)
- [Project Structure](#project-structure)
- [Import Boundaries](#import-boundaries)
- [Quality Commands](#quality-commands)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Development Setup

### Prerequisites

- **Node.js 20+** (recommended: 22)
- **npm**
- **Git**
- **Google Account** (optional, for Gemini Web and Google AI surfaces)

### Initial Setup

```bash
# Fork the repository, then clone your fork
git clone https://github.com/YOUR_USERNAME/quizlab.git
cd quizlab

# Install dependencies
npm install

# Start development mode (Electron + Vite)
npm run dev
```

Optional environment variables (see `.env.example`):

| Variable                     | Effect                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| `APP_ALLOW_MULTI_INSTANCE=1` | Allow multiple instances (default: single-instance).        |
| `APP_RENDERER_URL`           | Renderer dev server URL (default: `http://localhost:5173`). |
| `APP_OPEN_DEVTOOLS=1`        | Open DevTools on startup.                                   |

---

## Branch Strategy

| Branch      | Purpose                      |
| ----------- | ---------------------------- |
| `master`    | Production-ready code        |
| `feature/*` | New features or enhancements |
| `bugfix/*`  | Bug fixes                    |
| `hotfix/*`  | Critical production fixes    |

### Workflow

1. Create a branch from `master`:

   ```bash
   git checkout master
   git pull origin master
   git checkout -b feature/your-feature-name
   ```

2. Make changes and commit.
3. Push to your fork and open a Pull Request to `master`.

---

## Commit Message Guidelines

We follow conventional commits:

```text
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type       | Description                               |
| ---------- | ----------------------------------------- |
| `feat`     | New feature                               |
| `fix`      | Bug fix                                   |
| `docs`     | Documentation changes                     |
| `style`    | Code style (formatting, semicolons, etc.) |
| `refactor` | Code refactoring                          |
| `perf`     | Performance improvements                  |
| `test`     | Adding or updating tests                  |
| `chore`    | Build process or auxiliary tool changes   |

---

## Pull Request Checklist

Before submitting your PR:

- [ ] Code follows project TypeScript and React conventions
- [ ] All checks pass: `npm run typecheck`, `npm run lint`, `npm run test`
- [ ] Documentation updated if behavior or structure changed
- [ ] Commit messages follow conventional format
- [ ] No unused imports or dead code
- [ ] PR description clearly explains the changes

---

## Project Structure

```
src/
  app/                         # App shell, providers, effects
  features/
    your-feature/
      ui/                      # Feature UI components
      hooks/                   # Feature hooks
      model/                   # Types, constants, domain logic
      api/                     # Optional feature API surface
      index.ts                 # Public feature entry point
  shared/                      # Renderer-shared UI, hooks, i18n, constants
  platform/                    # Electron bridge adapters

electron/features/             # Main-process feature handlers
shared/                        # Cross-process constants and types
```

---

## Import Boundaries

- Use feature public API imports (`@features/settings`) outside `src/features/**`
- Avoid deep imports like `@features/<feature>/ui/*` from non-feature layers
- Use `@shared/*` for renderer shared code and `@shared-core/*` for cross-process contracts
- Do not use `@src/*` (deprecated)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full boundary policy.

---

## Quality Commands

```bash
# TypeScript type checking
npm run typecheck

# ESLint (zero warnings required)
npm run lint

# Run tests
npm run test

# Full build
npm run build

# Format code
npm run format
```

Pre-commit hooks are set up via **Husky** and **lint-staged** — they run lint and format automatically on staged files.

---

## Reporting Bugs

Open a [GitHub Issue](https://github.com/ozymandias-get/quizlab/issues/new?template=bug_report.md) and include:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- OS and app version

---

## Feature Requests

We welcome suggestions. Please:

- [Check existing issues](https://github.com/ozymandias-get/quizlab/issues) first
- Describe the use case clearly
- Explain why it would be valuable

---

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what is best for the community
- Show empathy towards others

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Questions

Open a [GitHub Discussion](https://github.com/ozymandias-get/quizlab/discussions) or comment on related issues.

---

Thank you for contributing to Quizlab Reader.
