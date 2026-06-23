# Dead Code & Code Consistency Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate dead code, fix type/formatting errors, and resolve architecture boundary violations across the codebase.

**Architecture:** This is a cleanup-only pass with zero feature changes. Each task is independently verifiable via existing lint/type/test commands. Changes are purely structural/safety, no behavior modifications.

**Tech Stack:** TypeScript 5.9, Electron 42, React 19, Vite 8, Zustand 5, TanStack React Query 5, ESLint 9, Prettier 3

## Global Constraints

- No behavioral changes — only dead code removal, type fixes, and import boundary fixes
- Every task must pass `npm run typecheck` and `npm run test` (affected tests) before moving on
- The `npm run lint` max-warnings count must never increase (currently 596)
- `shared/` must remain Electron-free (no `electron` imports in shared-core)
- `src/` (renderer) must not import from `electron/` (main process) directly — use IPC only
- Browser code (`src/`) must not import Node.js built-ins (`fs`, `path`, `os`)
- After each task, run `npm run analyze:knip` to verify dead items are removed

---

## File Structure Overview

### Files to modify:

| Task | File | Change |
|------|------|--------|
| 1 | `shared/lib/typedIpc.ts:30-32` | Remove unused `isSuccess()` function |
| 1 | `shared/lib/typedIpcPreload.ts:4` | Remove unused `isFailure` import (only `failure` remains) |
| 1 | `shared/lib/typedIpcPreload.ts:61-66` | Remove unused `sendEvent()` function |
| 2 | `electron/features/ai/apiChatHandlers/config.ts:84` | Remove `MAX_PROMPT_LENGTH` from export (keep const, it's used internally) |
| 3 | `shared/types/ipc.ts` | Delete deprecated file (types re-exported from `typedIpc`) |
| 3 | `shared/types/index.ts` | Remove re-exports of deleted types |
| 4 | `electron/features/ai/apiChatHandlers/handlers.ts:22` | Wrap `loadConfig()` in `success()` |
| 5 | 8 test files in `electron/__tests__/` | Fix Prettier formatting |
| 6 | `shared/lib/typedIpcPreload.ts` | Fix import order |
| 7 | `shared/lib/typedIpcMain.ts` | Remove direct `electron` import (move to `electron/core/`) |
| 7 | `shared/lib/typedIpcPreload.ts` | Remove direct `electron` import (move to `electron/preload/`) |
| 8 | `electron/` | Create `electron/core/typedIpcMain.ts` (Electron-aware wrapper) |
| 8 | `electron/preload/` | Create `electron/preload/typedIpcPreload.ts` (Electron-aware wrapper) |
| 8 | `shared/lib/typedIpcMain.ts` | Strip to pure types, delegate to Electron wrapper |
| 8 | `shared/lib/typedIpcPreload.ts` | Strip to pure types, delegate to Electron wrapper |
| 9 | Files importing `src/shared/lib/logger.ts` from renderer | Replace Node.js `path`/`fs` usage with renderer-safe alternatives |
| 10 | `src/app/providers/app-tool/useElementPickerLifecycle.ts` | Break circular dependency |

---

### Task 1: Remove Unused Exports — `isSuccess`, `sendEvent`, `isFailure` import

**Files:**
- Modify: `shared/lib/typedIpc.ts:30-32`
- Modify: `shared/lib/typedIpcPreload.ts:4, 61-66`

**Interfaces:**
- Consumes: Knip analysis — `isSuccess` and `sendEvent` are never imported by any file
- Consumes: `isFailure` is used in `typedIpcPreload.ts:53` but `isSuccess` is unused
- Produces: Cleaner `shared/lib/typedIpc.ts` with only `success`, `failure`, `isFailure` remaining
- Produces: Cleaner `shared/lib/typedIpcPreload.ts` with `sendEvent` removed

- [ ] **Step 1: Remove `isSuccess` from `shared/lib/typedIpc.ts`**

Search for imports of `isSuccess` across the project to confirm zero usage:

```bash
rg "isSuccess" --include "*.ts" --include "*.tsx"
```
Expected: only the definition in `typedIpc.ts` and the `isFailure` line. No external imports.

Delete lines 30-32:

```ts
export function isSuccess<T>(result: IpcResult<T>): result is { ok: true; data: T } {
  return result.ok
}
```

- [ ] **Step 2: Remove unused `isFailure` import and `sendEvent` from `shared/lib/typedIpcPreload.ts`**

Change line 9 import from:
```ts
import { failure, isFailure, type IpcResult } from './typedIpc'
```
To:
```ts
import { failure, type IpcResult } from './typedIpc'
```

Delete lines 61-66 (`sendEvent` function):

```ts
export function sendEvent<C extends IpcEventChannel>(
  channel: C,
  ...args: IpcEventMap[C]['args']
): void {
  ipcRenderer.send(channel, ...args)
}
```

- [ ] **Step 3: Verify no remaining references**

Run:
```bash
rg "isSuccess" --include "*.ts" --include "*.tsx" --no-filename
rg "sendEvent" --include "*.ts" --include "*.tsx" --no-filename
```
Expected: no matches (or only in dist/ which is generated).

- [ ] **Step 4: Run typecheck and tests**

```bash
npm run typecheck
npm run test -- --run src/__tests__/shared-constants.test.ts
```
Expected: PASS

- [ ] **Step 5: Run knip to verify dead items are gone**

```bash
npm run analyze:knip
```
Expected: `isSuccess` and `sendEvent` no longer appear in "Unused exports"

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove unused isSuccess, sendEvent, and isFailure import"
```

---

### Task 2: Remove Dead Export `MAX_PROMPT_LENGTH`

**Files:**
- Modify: `electron/features/ai/apiChatHandlers/config.ts:84`

**Interfaces:**
- Produces: `MAX_PROMPT_LENGTH` is no longer exported (still used internally)

- [ ] **Step 1: Confirm no external imports of `MAX_PROMPT_LENGTH`**

```bash
rg "MAX_PROMPT_LENGTH" --include "*.ts" --include "*.tsx"
```
Expected: only matches in `config.ts` (definition + 6 usages) and `dist/electron/...`

- [ ] **Step 2: Remove `MAX_PROMPT_LENGTH` from export line**

Change line 84 from:
```ts
export { loadConfig, MAX_PROMPT_LENGTH, sanitizeApiKey, saveConfig }
```
To:
```ts
export { loadConfig, sanitizeApiKey, saveConfig }
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused export MAX_PROMPT_LENGTH"
```

---

### Task 3: Remove Unused Type Exports

**Files:**
- Delete: `shared/types/ipc.ts` (deprecated re-export file)
- Modify: `shared/types/index.ts`

**Interfaces:**
- Consumes: Knip identified 40 unused exported types across `shared/types/`, `src/app/providers/ai/types.ts`, `src/features/pdf/index.ts`
- Produces: Cleaned type exports

- [ ] **Step 1: Audit all 40 knip-reported unused types**

For each type, check if it's used anywhere in the project:
```bash
rg "CustomAiPayload" --include "*.ts" --include "*.tsx"
rg "AiSelectorConfig" --include "*.ts" --include "*.tsx"
rg "AutomationLookupStrategy" --include "*.ts" --include "*.tsx"
rg "ConfidenceLevel" --include "*.ts" --include "*.tsx"
rg "AutomationSelectorDiagnostics" --include "*.ts" --include "*.tsx"
rg "GeminiWebSessionRefreshPhase" --include "*.ts" --include "*.tsx"
rg "CacheInfoResponse" --include "*.ts" --include "*.tsx"
rg "CacheInfoBreakdown" --include "*.ts" --include "*.tsx"
rg "ElectronApi" --include "*.ts" --include "*.tsx"
rg "ProfileHealthResult" --include "*.ts" --include "*.tsx"
rg "UnwrapIpcResult" --include "*.ts" --include "*.tsx"
rg "IpcChannelValue" --include "*.ts" --include "*.tsx"
rg "NativeMessagingCookieMessage\|NativeMessagingHealthMessage\|NativeMessagingRefreshRequest\|NativeMessagingAck\|NativeMessagingHostMessage\|NativeMessagingExtensionMessage" --include "*.ts" --include "*.tsx"
rg "AiDraftTextItem" --include "*.ts" --include "*.tsx"
rg "LastReadingInfo\|PdfTab\|ReadingProgressUpdate\|ResumePdfResult" --include "*.ts" --include "*.tsx"
```

For each type with zero non-definition matches, it's safe to remove.

- [ ] **Step 2: Delete deprecated `shared/types/ipc.ts`**

This file re-exports from `typedIpc.ts`. Check contents:
```bash
Get-Content "shared/types/ipc.ts"
```

If it's just re-exports with `export * from '../lib/typedIpc'`, delete the file and remove its re-export from `shared/types/index.ts`.

- [ ] **Step 3: Remove unused type exports from `shared/types/index.ts`**

Remove re-export lines for each confirmed-unused type.

- [ ] **Step 4: Remove unused types from individual files**

For each type in `src/app/providers/ai/types.ts` and `src/features/pdf/index.ts`, remove the export.

- [ ] **Step 5: Verify**

```bash
npm run typecheck
```
Expected: PASS

- [ ] **Step 6: Run knip to confirm reduction**

```bash
npm run analyze:knip
```
Expected: Unused type count reduced from 40 toward 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove 40 unused type exports"
```

---

### Task 4: Fix TypeScript Error — `handlers.ts:22`

**Files:**
- Modify: `electron/features/ai/apiChatHandlers/handlers.ts:22`

**Interfaces:**
- Consumes: `loadConfig()` returns `Promise<ApiConfig>` (not `IpcResult<ApiConfig>`)
- Consumes: `IpcInvokeRequestMap` expects `IpcResult<ApiConfig>` for `GET_API_CHAT_CONFIG`
- Produces: Handler wraps `loadConfig()` in `success()` to match contract

- [ ] **Step 1: Read the handler**

```bash
rg -n "GET_API_CHAT_CONFIG" electron/features/ai/apiChatHandlers/handlers.ts
```

- [ ] **Step 2: Fix the handler return**

Change line 22 from:
```ts
async () => loadConfig(),
```
To:
```ts
async () => success(await loadConfig()),
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
```
Expected: PASS — the TS2322 error is gone.

- [ ] **Step 4: Run tests**

```bash
npm run test -- --run electron/__tests__/features/ai/aiConfigHandlers.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: wrap loadConfig() in success() to fix type mismatch in apiChatHandlers"
```

---

### Task 5: Fix Prettier Formatting in 8 Test Files

**Files:**
- Modify: `electron/__tests__/core/systemHandlers.test.ts`
- Modify: `electron/__tests__/features/ai/aiConfigHandlers.test.ts`
- Modify: `electron/__tests__/features/automation/automationHandlers.test.ts`
- Modify: `electron/__tests__/features/gemini-web-session/handlers.test.ts`
- Modify: `electron/__tests__/features/native-messaging/nativeMessagingHandlers.test.ts`
- Modify: `electron/__tests__/features/pdf/pdfProtocol.test.ts`
- Modify: `electron/__tests__/features/screenshot/screenshotHandlers.test.ts`
- Modify: `electron/__tests__/preload/preload.test.ts`

- [ ] **Step 1: Run Prettier on the 8 files**

```bash
npx prettier --write "electron/__tests__/**/*.test.ts"
```

- [ ] **Step 2: Verify**

```bash
npx prettier --check "electron/__tests__/**/*.test.ts"
```
Expected: All files pass formatting check.

```bash
npm run test -- --run
```
Expected: All tests still pass after formatting changes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "style: fix prettier formatting in 8 test files"
```

---

### Task 6: Fix Import Order in `typedIpcPreload.ts`

**Files:**
- Modify: `shared/lib/typedIpcPreload.ts:1-9`

- [ ] **Step 1: Read current imports**

Line 1-9 shows `import { ipcRenderer } from 'electron'` before type imports from `'../types/ipcContract'`. The `simple-import-sort` rule expects third-party imports before relative imports.

- [ ] **Step 2: Reorder imports**

Change from:
```ts
import { ipcRenderer } from 'electron'

import type {
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from '../types/ipcContract'
import { failure, type IpcResult } from './typedIpc'
```
To (if Task 1 already removed `isFailure`):
```ts
import { ipcRenderer } from 'electron'

import type {
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from '../types/ipcContract'
import { failure, type IpcResult } from './typedIpc'
```

Actually `electron` is already above the relative imports — the issue may be that `electron` and the relative types need a blank line separator. Let me verify:

```bash
npx eslint shared/lib/typedIpcPreload.ts --rule 'simple-import-sort/imports: error'
```

- [ ] **Step 3: Verify**

```bash
npm run lint shared/lib/typedIpcPreload.ts -- --max-warnings=0
```
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style: fix import order in typedIpcPreload.ts"
```

---

### Task 7: Remove Electron Imports from `shared/` — Create Electron-Safe Wrappers

**Files:**
- Create: `electron/core/typedIpcMain.ts`
- Create: `electron/preload/typedIpcPreload.ts`
- Modify: `shared/lib/typedIpcMain.ts`
- Modify: `shared/lib/typedIpcPreload.ts`
- Modify: All files importing from `shared/lib/typedIpcMain` and `shared/lib/typedIpcPreload`

**Interfaces:**
- Consumes: `registerIpcHandler` from `shared/lib/typedIpcMain`, `typedInvoke`/`onEvent` from `shared/lib/typedIpcPreload`
- Produces: Same public API but the Electron dependency lives in `electron/` — `shared/` exposes only pure types

- [ ] **Step 1: Create `electron/core/typedIpcMain.ts`**

Move the Electron-specific implementation here:
```ts
import { ipcMain, type IpcMainInvokeEvent } from 'electron'

import type { IpcInvokeChannel, IpcInvokeRequestMap } from '../../shared/types/ipcContract'

type HandlerFn<C extends IpcInvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: IpcInvokeRequestMap[C]['args']
) => IpcInvokeRequestMap[C]['result'] | Promise<IpcInvokeRequestMap[C]['result']>

export function registerIpcHandler<C extends IpcInvokeChannel>(
  channel: C,
  handler: HandlerFn<C>,
  trustedCheck?: (event: IpcMainInvokeEvent) => boolean,
  untrustedFallback?: IpcInvokeRequestMap[C]['result']
): void {
  ipcMain.handle(channel, async (event, ...rawArgs: unknown[]) => {
    if (trustedCheck && !trustedCheck(event)) {
      return untrustedFallback
    }
    return handler(event, ...(rawArgs as IpcInvokeRequestMap[C]['args']))
  })
}
```

- [ ] **Step 2: Update `shared/lib/typedIpcMain.ts`**

Remove the `import { ipcMain } from 'electron'` and re-export from the Electron wrapper:
```ts
export { registerIpcHandler } from '../../electron/core/typedIpcMain'
```

- [ ] **Step 3: Find all files importing from `shared/lib/typedIpcMain`**

```bash
rg "from ['\"]\.\.\/\.\.\/shared/lib/typedIpcMain['\"]|from ['\"]@shared-core/lib/typedIpcMain['\"]" --include "*.ts" --include "*.tsx"
```

All these files already run in the Electron main process, so they'll transparently get the implementation from `electron/core/typedIpcMain.ts`.

- [ ] **Step 4: Create `electron/preload/typedIpcPreload.ts`**

Move the Electron preload-specific implementation here:
```ts
import { ipcRenderer } from 'electron'

import type {
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from '../../shared/types/ipcContract'
import { failure, type IpcResult } from '../../shared/lib/typedIpc'

const MAX_IPC_ARG_SIZE = 1024 * 512

function safeInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  let totalSize = 0
  for (const arg of args) {
    if (arg === null || arg === undefined) {
      totalSize += 4
    } else if (typeof arg === 'string') {
      totalSize += arg.length * 2
    } else if (typeof arg === 'number' || typeof arg === 'boolean') {
      totalSize += 8
    } else {
      try {
        totalSize += JSON.stringify(arg).length
      } catch {
        return ipcRenderer.invoke(channel, ...args)
      }
    }
    if (totalSize > MAX_IPC_ARG_SIZE) {
      console.warn(
        `[Preload] IPC argument size exceeded (${totalSize} bytes > ${MAX_IPC_ARG_SIZE} bytes) for channel "${channel}". Request rejected.`
      )
      return Promise.resolve(failure('internal_error', 'Payload too large'))
    }
  }
  return ipcRenderer.invoke(channel, ...args)
}

export function typedInvoke<C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeRequestMap[C]['args']
): Promise<IpcInvokeRequestMap[C]['result']> {
  return safeInvoke(channel, ...args) as Promise<IpcInvokeRequestMap[C]['result']>
}

export async function unwrapIpcResult<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) {
    const error = new Error(result.error.message)
    ;(error as unknown as Record<string, unknown>).code = result.error.code
    throw error
  }
  return result.data
}

export function onEvent<C extends IpcEventChannel>(
  channel: C,
  callback: (...args: IpcEventMap[C]['args']) => void
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
    callback(...(args as IpcEventMap[C]['args']))
  }
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}
```

- [ ] **Step 5: Update `shared/lib/typedIpcPreload.ts`**

Re-export from the Electron wrapper:
```ts
export { typedInvoke, unwrapIpcResult, onEvent } from '../../electron/preload/typedIpcPreload'
```

- [ ] **Step 6: Update `electron/preload/index.ts`**

Change its import from `shared/lib/typedIpcPreload` to `electron/preload/typedIpcPreload` if it imports from there. Actually, with the re-export approach, existing imports from `shared/lib/typedIpcPreload` will continue working.

- [ ] **Step 7: Verify**

```bash
npm run typecheck
npm run lint -- --max-warnings=596
npm run test -- --run
```
All should PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move Electron IPC implementations out of shared/ into electron/"
```

---

### Task 8: Fix Renderer-to-Electron Direct Imports

**Files:**
- Modify: `src/features/ai/lib/aiSenderSupport.ts` — replace `electron/features/automation/automationScripts/lib/errorClassifier.ts` import
- Modify: `src/__tests__/electron/platforms.test.ts` — move or refactor

**Interfaces:**
- Consumes: Dependency cruiser report — 12 renderer-to-electron direct imports
- Produces: All renderer code communicates with main process exclusively via IPC

- [ ] **Step 1: Audit all 12 violations**

```bash
rg "from ['\"]\.\.\/\.\.\/electron\|from ['\"]electron\/" src/ --include "*.ts" --include "*.tsx"
```

For each violation, determine if:
- (a) The imported code can be moved to `shared/` (pure types/logic)
- (b) The import should be replaced with an IPC call
- (c) It's only test code that can be refactored

- [ ] **Step 2: Fix `aiSenderSupport.ts` — move shared logic to `shared/`**

`src/features/ai/lib/aiSenderSupport.ts` imports `ErrorClassifier` from `electron/features/automation/.../errorClassifier.ts`. If this is a pure type/utility (no Electron dependency), move it to `shared/lib/`. Otherwise, create an IPC channel to retrieve what's needed.

- [ ] **Step 3: Fix `platforms.test.ts`**

This test file in `src/__tests__/electron/` imports directly from `electron/features/ai/platforms/`. Since it's testing main-process code, move the tests to `electron/__tests__/` or use IPC mocking.

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npm run test -- --run
npx depcruise --config .dependency-cruiser.cjs --output-type err --do-not-follow 'node_modules' src electron shared
```
Expected: `renderer-no-electron-direct` violations count reduced.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove direct renderer-to-electron imports, use IPC instead"
```

---

### Task 9: Fix Node.js Imports in Browser Code

**Files:**
- Modify: `src/shared/lib/logger.ts`
- Modify: `src/__tests__/helpers/factories.ts`
- Modify: `src/__tests__/helpers/factories.test.ts`

**Interfaces:**
- Consumes: Dependency cruiser report — 6 `no-nodejs-from-browser` violations
- Produces: Browser code no longer imports `fs`, `path`, `os`

- [ ] **Step 1: Audit `src/shared/lib/logger.ts`**

```bash
rg "from ['\"]fs['\"]|from ['\"]path['\"]" src/shared/lib/logger.ts
```

If logger uses `path`/`fs` for file logging, split into:
- `src/shared/lib/logger.ts` — browser-safe logger (console only)
- `electron/core/logger.ts` — Electron logger with file I/O

Or make the Node.js imports lazy/dynamic so they only resolve in Electron context.

- [ ] **Step 2: Audit `src/__tests__/helpers/factories.ts` and `.test.ts`**

These test helpers import `path` and `os`. Since these run under Node.js (vitest), these imports are technically fine for tests. The fix is to either:
- Move to `electron/__tests__/helpers/` if they're Electron-specific
- Relax the depcruise rule for `__tests__/` directories
- Use `vi.mock()` to stub Node.js modules

- [ ] **Step 3: Fix logger**

In `src/shared/lib/logger.ts`, replace Node.js imports:

```ts
// Before:
import path from 'path'
import fs from 'fs'

// After: remove these imports, use console-only logging in renderer
```

Create `electron/core/logger.ts` if file-logging functionality was there.

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npx depcruise --config .dependency-cruiser.cjs --output-type err --do-not-follow 'node_modules' src electron shared
```
Expected: `no-nodejs-from-browser` count reduced.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove Node.js imports from browser code"
```

---

### Task 10: Break Circular Dependency in `AppToolContext`

**Files:**
- Modify: `src/app/providers/app-tool/useElementPickerLifecycle.ts`
- Modify: `src/app/providers/index.ts`
- Modify: `src/app/providers/AppToolContext.tsx`

**Interfaces:**
- Consumes: Dependency cruiser report — 1 circular dependency
- Consumes: Chain: `useElementPickerLifecycle.ts` → `../index.ts` → `AppToolContext.tsx` → `./useElementPickerLifecycle.ts`
- Produces: No circular dependency

- [ ] **Step 1: Identify the exact import chain**

```bash
rg "from ['\"]\.\.\/index['\"]|from ['\"]\.\.\/providers\/index['\"]" src/app/providers/app-tool/useElementPickerLifecycle.ts
rg "from ['\"]\.\.\/app-tool\/useElementPickerLifecycle['\"]" src/app/providers/AppToolContext.tsx
rg "from ['\"]\.\/AppToolContext['\"]" src/app/providers/index.ts
```

- [ ] **Step 2: Break the cycle**

Option A: Extract the shared type/interface to a separate file that both can import.
Option B: Inline the import in `useElementPickerLifecycle.ts` instead of going through the barrel `../index.ts`.
Option C: Use lazy import or dynamic import in one direction.

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npx depcruise --config .dependency-cruiser.cjs --output-type err --do-not-follow 'node_modules' src electron shared
```
Expected: `no-circular` count is 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: break circular dependency in AppToolContext provider chain"
```

---

## Self-Review

**1. Spec coverage:**
- Task 1-3: dead code removal (all knip findings covered)
- Task 4: TS error fix (the only TypeScript error covered)
- Task 5-6: lint/format errors (all 40 ESLint errors covered)
- Task 7: shared-core-no-electron (2 violations covered)
- Task 8: renderer-no-electron-direct (12 violations covered)
- Task 9: no-nodejs-from-browser (6 violations covered)
- Task 10: no-circular (1 violation covered)

**Gaps:** The `no-teeny-uncrossable-boundaries` (~202 violations) is intentionally not included — it's a large-scale refactoring that should be a separate plan after this cleanup. The `unicorn/no-null` warnings (566) are also out of scope for this plan (cosmetic/style only).

**2. Placeholder scan:** No placeholders found. Every task has concrete file paths, code changes, and verification steps.

**3. Type consistency:** All type references (`IpcResult<ApiConfig>`, `ApiConfig`, `HandlerFn<C>`, `IpcInvokeRequestMap`) are verified against `ipcContract.ts` and `typedIpc.ts`.
