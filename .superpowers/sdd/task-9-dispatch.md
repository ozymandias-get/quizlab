You are implementing Task 9: Fix Node.js Imports in Browser Code

There are 6 depcruise violations where files in `src/` import Node.js built-ins.

## Context

Branch `cleanup/dead-code-consistency`, project root `C:\Users\Umutu\Downloads\quizlab-master`. Tasks 1-5, 7, 3, 8 done.

## Violations to fix

### Fix 1: `src/shared/lib/logger.ts` → `path` and `fs` (2 violations)

The file uses `require('path')` and `require('fs')` inside runtime-guarded functions (lines 195, 255-256, 286-287). These only execute in Electron main process and are guarded by `typeof require !== 'function'`.

**Approach:** Extract the disk-logging code from `src/shared/lib/logger.ts` into a separate file only the main process imports. Clean `src/shared/lib/logger.ts` to be renderer-safe.

**Step 1.1:** Read the full logger.ts:
```
Get-Content src/shared/lib/logger.ts
```

**Step 1.2:** Create `electron/core/logger.ts` with the disk-logging functionality:

```ts
import { Logger } from '../../src/shared/lib/logger'

// Re-export the base logger
export { Logger }

// Disk logging — only available in Electron main process
// Pulled from src/shared/lib/logger.ts to keep that file renderer-safe

const LOG_BUFFER_LIMIT = 400
const fs = require('fs')
const path = require('path')

// ... move disk-logging functions here
// Specifically: tryResolveLogDir, ensureLogDir, writeToDisk functions
// and any function that uses the disk log path
```

**Step 1.3:** In `src/shared/lib/logger.ts`, remove or guard all `require('path')`/`require('fs')` calls behind a check that makes them invisible to depcruise. The simplest approach:

Replace the dynamic requires with imports that depcruise won't flag. Since these are inside functions that only run in Electron context, replace:

```ts
const path = require('path')
```
with a function-level import that won't trigger the rule. Actually, since `require()` isn't a static import, the simplest fix is to move the disk path logic to a conditional that avoids requiring nodes built-ins in the browser bundle at all.

**The cleanest fix:** Keep `src/shared/lib/logger.ts` browser-safe by REMOVING ALL disk-logging code. Create `electron/core/diskLogger.ts` that imports from `src/shared/lib/logger.ts` and adds disk persistence.

Read the full file first to understand the structure, then:
1. Remove disk-logging from `src/shared/lib/logger.ts` (functions that use `path`/`fs`)
2. Create `electron/core/diskLogger.ts` with that functionality 
3. Update `electron/app/index.ts` or whoever calls `initLogger({logToDisk: true})` to use the new disk logger

### Fix 2: Test helper files → `path` and `os` (4 violations)

`src/__tests__/helpers/factories.ts` and `factories.test.ts` import `path` and `os` for test file setup. These run under vitest (Node.js), not in a browser.

**Approach:** Either:
- (a) Adjust `dependency-cruiser.cjs` to exclude `__tests__/` from the `no-nodejs-from-browser` rule
- (b) Move the helpers to `electron/__tests__/helpers/`

Option (a) is cleaner since these ARE renderer tests that legitimately need Node.js for file setup.

Update `.dependency-cruiser.cjs` line 63-69. Change the `from` rule from:
```js
{
  name: 'no-nodejs-from-browser',
  severity: 'error',
  comment: 'Browser kodu Node.js modülü import etmemeli',
  from: {
    path: '^src/'
  },
  to: {
    path: '^(fs|path|...)$'
  }
}
```
To:
```js
{
  name: 'no-nodejs-from-browser',
  severity: 'error',
  comment: 'Browser kodu Node.js modülü import etmemeli (testler hariç)',
  from: {
    path: '^src/',
    pathNot: '\\.test\\.(ts|tsx)$'
  },
  to: {
    path: '^(fs|path|child_process|os|crypto|net|http|https|stream|events|buffer|util|assert|url|querystring|zlib|tls|cluster|dgram|dns|readline|repl|vm|v8|worker_threads)$'
  }
}
```

### Verification

1. Run typecheck:
```bash
npm run typecheck
```
Expected: PASS

2. Run tests:
```bash
npm run test -- --run
```
Expected: PASS

3. Check depcruise:
```bash
npx depcruise --config .dependency-cruiser.cjs --output-type err --do-not-follow 'node_modules' src electron shared
```
Expected: `no-nodejs-from-browser` count reduced from 6 toward 0.

4. Commit:
```bash
git add -A
git commit -m "refactor: remove Node.js imports from browser code"
```

## Report

Report back with:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What approach you used for each fix
- Depcruise violation count remaining
- Test results
- Any concerns