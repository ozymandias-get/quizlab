# Contributing to Quizlab Reader

Thank you for your interest in contributing to Quizlab Reader. This guide reflects the current repository layout and contribution workflow.

## Development Setup

### Prerequisites

- **Node.js 18+** (recommended: 20+)
- **npm**
- **Google Account** (optional, for Gemini Web and Google AI surfaces in the embedded browser)
- **Git**

### Initial Setup

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/quizlab.git
cd quizlab

# Install dependencies
npm install

# Run in development mode
npm run dev
```

Optional Electron dev environment variables (all optional):

| Variable                     | Effect                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| `APP_ALLOW_MULTI_INSTANCE=1` | Allow more than one running instance (default is single-instance). |
| `APP_RENDERER_URL`           | Dev server URL for the renderer (default `http://localhost:5173`). |
| `APP_OPEN_DEVTOOLS=1`        | Open DevTools when the main window loads.                          |

## Branch Strategy

We use a simple branching model:

| Branch      | Purpose                      |
| ----------- | ---------------------------- |
| `master`    | Production-ready code        |
| `feature/*` | New features or enhancements |
| `bugfix/*`  | Bug fixes                    |
| `hotfix/*`  | Critical production fixes    |

### Workflow

1. Create a new branch from `master`:

   ```bash
   git checkout master
   git pull origin master
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit.
3. Push to your fork and open a Pull Request to `master`.

## Commit Message Guidelines

We follow conventional commit format:

```text
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type       | Description                                       |
| ---------- | ------------------------------------------------- |
| `feat`     | New feature                                       |
| `fix`      | Bug fix                                           |
| `docs`     | Documentation changes                             |
| `style`    | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring                                  |
| `perf`     | Performance improvements                          |
| `test`     | Adding or updating tests                          |
| `chore`    | Build process or auxiliary tool changes           |

## Pull Request Checklist

Before submitting your PR, please ensure:

- [ ] Code follows the project's TypeScript and React conventions
- [ ] Checks pass: `npm run typecheck`, `npm run lint`, `npx vitest run`
- [ ] Documentation is updated if behavior or structure changed
- [ ] Commit messages follow the convention
- [ ] PR description clearly explains the changes
- [ ] No unused imports or variables left behind

## Project Structure

When adding new work, follow the current layered architecture:

```text
src/
  app/                         # App shell, providers, effects
  features/
    your-feature/
      ui/                      # Feature UI components
      hooks/                   # Feature hooks
      model/                   # Feature types/constants/domain
      api/                     # Optional feature API surface
      index.ts                 # Public feature entry point
  shared/                      # Renderer-shared UI/hooks/lib/constants/i18n
  platform/electron/           # Renderer <-> Electron bridge

electron/features/your-feature/  # Main-process feature handlers/services
shared/                          # Cross-process constants/types
```

Import boundaries:

- Use feature public API imports (for example, `@features/settings`) outside `src/features/**`.
- Avoid deep feature imports such as `@features/<feature>/ui/*` from non-feature layers.
- Use `@shared/*` for renderer shared code and `@shared-core/*` for cross-process contracts.
- Do not introduce deprecated `@src/*` imports.

## Testing

```bash
npm run typecheck
npm run lint
npx vitest run
npm run build
```

## Reporting Bugs

Please use GitHub Issues and include:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- System info (OS, app version)

## Feature Requests

We welcome feature suggestions. Please:

- Check existing issues first
- Describe the use case clearly
- Explain why it would be valuable

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what is best for the community
- Show empathy towards others

## Questions

Feel free to open a GitHub Discussion or comment on related issues.

---

Thank you for contributing to Quizlab Reader.
