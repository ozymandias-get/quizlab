# Architecture Guardrails

This document defines stable architectural boundaries for the post-refactor structure.

## Layers

- `src/app`: Application shell, composition root, providers, app-level effects/hooks.
- `src/features`: Domain features (`ai`, `pdf`, `quiz`, `settings`, `screenshot`, `automation`, `tutorial`).
- `src/shared`: Renderer-shared UI, hooks, constants, i18n, styles, utility libraries, renderer-only types.
- `src/platform`: Platform adapters (Electron bridge hooks/APIs).
- `shared` (`@shared-core/*`): Cross-process shared contracts (IPC channels, shared types).

## Alias Policy

- `@app/*` -> `src/app/*`
- `@features/*` -> `src/features/*`
- `@platform/*` -> `src/platform/*`
- `@ui/*` -> `src/shared/ui/*`
- `@shared/*` -> `src/shared/*`
- `@shared-core/*` -> `shared/*`
- `@src/*` -> forbidden

Note: To avoid GitHub mention-like rendering, always write aliases in docs with backticks (for example, ``@features/*``).

## Import Boundary Rules

### Feature Public API

- Feature internals (`ui`, `model`, `api`) are private from outside `src/features`.
- External consumers must import feature entry points:
  - Allowed: `@features/quiz`
  - Allowed: `@features/quiz/index`
  - Forbidden outside `src/features`: `@features/quiz/ui/*`, `@features/quiz/model/*`, `@features/quiz/api/*`

### Shared vs Shared-Core

- `@shared/*` is renderer-side shared code.
- `@shared-core/*` is runtime-agnostic cross-process contract code.
- `shared/` must not depend on Electron or DOM globals.

## Do / Don't Examples

### Do

```ts
import { QuizModule } from '@features/quiz'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import type { QuizSettings } from '@shared-core/types'
```

### Don't

```ts
import QuizModule from '@features/quiz/ui/QuizModule'
import { Something } from '@src/utils/something'
import { app } from 'electron'
```

## Validation Commands

Run these checks locally before committing structural changes:

```bash
npm run typecheck
npm run lint
npx vitest run
npm run build
```
