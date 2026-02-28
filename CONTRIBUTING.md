# Contributing to QuizLab Reader

Thank you for your interest in contributing to QuizLab Reader! This document provides guidelines to help you get started.

## 🚀 Development Setup

### Prerequisites

- **Node.js 18+** (recommended: 20+)
- **npm**
- **Google Account** (for Gemini CLI features)
- **Git**

### Initial Setup

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/quizlab.git
cd quizlab

# Install dependencies
npm install

# Install Gemini CLI globally (required for quiz generation)
npm install -g @google/gemini-cli

# Run in development mode
npm run dev
```

## 🌿 Branch Strategy

We use a simple branching model:

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `develop` | Integration branch for features |
| `feature/*` | New features or enhancements |
| `bugfix/*` | Bug fixes |
| `hotfix/*` | Critical production fixes |

### Workflow

1. Create a new branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit

3. Push to your fork and open a Pull Request to `develop`

## 📝 Commit Message Guidelines

We follow conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Build process or auxiliary tool changes |

### Examples

```
feat(quiz): add timer functionality to quiz module

fix(pdf): resolve zoom issue on high-DPI displays

docs(readme): update installation instructions

refactor(ai): simplify AI platform registry
```

## ✅ Pull Request Checklist

Before submitting your PR, please ensure:

- [ ] Code follows the project's TypeScript and React conventions
- [ ] All existing tests pass (`npm run typecheck`)
- [ ] New features include appropriate tests
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow the convention
- [ ] PR description clearly explains the changes
- [ ] No `console.log` statements left in production code
- [ ] No unused imports or variables

## 🏗 Code Style Guidelines

### TypeScript

- Enable strict mode compliance
- Explicit types for all functions and variables
- Interface names use `PascalCase`
- Avoid `any` type

### React

- Functional components with hooks only
- Component names: `PascalCase` (e.g., `QuizModule.tsx`)
- Hook names: `useCamelCase` (e.g., `useQuizTimer.ts`)
- Props interfaces defined inline or in shared types

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | `PascalCase.tsx` | `AiWebview.tsx` |
| Hooks | `useCamelCase.ts` | `useAiSender.ts` |
| Utilities | `camelCase.ts` | `promptBuilder.ts` |
| Styles | `_kebab-case.css` | `_glass-panel.css` |

## 🧪 Testing

```bash
# Type checking
npm run typecheck

# Run tests (when available)
npx vitest
```

## 📂 Project Structure

When adding new features, follow the feature-based architecture:

```
src/features/your-feature/
├── components/       # React components
├── hooks/           # Custom hooks
├── utils/           # Feature-specific utilities
└── types/           # TypeScript types

electron/features/your-feature/
├── handlers.ts      # IPC handlers
└── service.ts       # Business logic
```

## 🐛 Reporting Bugs

Please use GitHub Issues and include:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- System info (OS, app version)

## 💡 Feature Requests

We welcome feature suggestions! Please:

- Check existing issues first
- Describe the use case clearly
- Explain why it would be valuable

## 📜 Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what's best for the community
- Show empathy towards others

## ❓ Questions?

Feel free to:
- Open a GitHub Discussion
- Comment on related issues
- Check existing documentation

---

Thank you for contributing to QuizLab Reader! 🎉
