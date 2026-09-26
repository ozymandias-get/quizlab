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

### Selector Self-Healing

The selector engine already _recovers_ elements after the saved selector breaks
(`primary → candidates → fingerprint → semantic → provider/site strategy →
heuristic`). Self-healing adds the missing half: turning that recovery into
persistent configuration, deterministically and without an LLM.

```
saved selector
  → normal resolve (cache → primary/candidates → fingerprint → fallback)
  → recovered? (candidate | fingerprint | semantic | provider | heuristic)
  → confidence gate (score, ambiguity gap, stability, send-control blocklist)
  → real pipeline success (text inserted / submit clicked) required
  → staged SelectorRepairCandidate (consecutive success counter)
  → threshold reached → promote (old primary kept as first fallback)
  → sanitizeConfig → disk
```

Ownership:

| Concern                                              | Owner                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| Policy (thresholds, confidence, promotion, flapping) | `shared/selectorRepair.ts` (single source of truth)             |
| Runtime evidence + stable selector re-derivation     | `electron/.../lib/selectorRepairRuntime.ts`                     |
| Stable CSS selector generation                       | `pickerDomRuntime.ts` — reused verbatim, never re-implemented   |
| Sanitization / persistence                           | `electron/features/ai/aiConfigSanitize.ts`, `aiConfigDomain.ts` |
| Staging / promotion decisions                        | `src/features/ai/lib/selectorRepair/evaluateRepairEvidence.ts`  |
| Write + cache invalidation                           | `src/features/ai/lib/selectorRepair/applySelectorRepair.ts`     |

Rules that are easy to break and therefore covered by tests:

- The injected script never persists anything. Only serializable metadata
  (selector, strategy, score, counters) crosses IPC — never an `Element`.
- "Found in the DOM" is **not** a success. Only a completed pipeline operation
  counts, and the input and the send button are credited independently.
- Medium/low confidence, an ambiguous score gap, a blocklisted send control, a
  build-generated class and a runtime marker selector all refuse promotion.
- Button repairs are strictly more conservative than input repairs.
- A promoted selector keeps the old primary as its first fallback, and a repair
  that keeps flapping inside `REPAIR_FLAP_WINDOW_MS` is refused.
- Config writes only happen on a material transition; the runtime `ConfigCache`
  is dropped after a promotion so the next send uses the new selector.

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
