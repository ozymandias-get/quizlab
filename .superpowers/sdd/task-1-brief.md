# Task 1: Remove Unused Exports — `isSuccess`, `sendEvent`, `isFailure` import

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
