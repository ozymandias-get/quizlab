# Architecture Guardrails

This document defines stable architectural boundaries for the Quizlab Reader codebase.

## Layers

| Layer           | Path                         | Purpose                                                                           |
| --------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| **App Shell**   | `src/app/`                   | Composition root, providers, app-level effects                                    |
| **Features**    | `src/features/`              | Domain features (`ai`, `pdf`, `settings`, `screenshot`, `automation`, `tutorial`) |
| **Shared**      | `src/shared/`                | Renderer-shared UI, hooks, constants, i18n, styles, utilities                     |
| **Platform**    | `src/platform/`              | Platform adapters (Electron bridge hooks/APIs)                                    |
| **Shared Core** | `shared/` (`@shared-core/*`) | Cross-process contracts (IPC channels, shared types)                              |

### AI Send Queue

The AI send draft queue (`pendingAiItems` → `planBulkAiSend`) delivers excerpts to the active tab **in user order**, with the composer UI reflecting that same sequence.

## Alias Policy

| Alias            | Path              |
| ---------------- | ----------------- |
| `@app/*`         | `src/app/*`       |
| `@features/*`    | `src/features/*`  |
| `@platform/*`    | `src/platform/*`  |
| `@ui/*`          | `src/shared/ui/*` |
| `@shared/*`      | `src/shared/*`    |
| `@shared-core/*` | `shared/*`        |
| `@src/*`         | ❌ Forbidden      |

> Note: To avoid GitHub mention-like rendering, always write aliases in backticks (e.g., `` `@features/*` ``).

## Import Boundary Rules

### Feature Public API

- Feature internals (`ui/`, `model/`, `api/`) are private from outside `src/features/`
- External consumers **must** import feature entry points (e.g., `` `@features/pdf` ``, `` `@features/ai` ``)
- **Forbidden** outside `src/features/`: deep imports like `` `@features/<feature>/ui/*` `` unless the feature's public API explicitly re-exports them

### Shared vs Shared-Core

- `` `@shared/*` `` is renderer-side shared code
- `` `@shared-core/*` `` is runtime-agnostic cross-process contract code
- `shared/` must not depend on Electron or DOM globals

## Do / Don't Examples

### Do

```ts
import { PdfViewer } from '@features/pdf'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import type { AiRegistryResponse } from '@shared-core/types'
```

### Don't

```ts
import PdfViewer from '@features/pdf/ui/components/PdfViewer'
import { Something } from '@src/utils/something'
import { app } from 'electron'
```

## Validation Commands

Run these checks before committing structural changes:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
