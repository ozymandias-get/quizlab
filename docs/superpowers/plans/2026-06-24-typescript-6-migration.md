# TypeScript 5.9 → 6.0 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade TypeScript from 5.9.3 to 6.0.3 with full tsconfig migration (no `ignoreDeprecations`).

**Architecture:** TS6 deprecates `baseUrl`, `moduleResolution: "Node"` (node10), and changes `types` default to `[]`. We remove deprecated options and adopt `moduleResolution: "Bundler"` for Node configs while adding explicit `types: ["node"]` for NodeJS global types.

**Tech Stack:** TypeScript 6.0.3, Electron backend (CommonJS), Vite/React renderer (bundler), esbuild preload bundling.

## Global Constraints

- TypeScript version must be `^6.0.3` in `package.json`
- All deprecation warnings must be resolved, not suppressed
- The `build:backend` script (`tsc -b tsconfig.node.json --force && esbuild ...`) must continue to work
- All existing type-checking (`tsc -b`, `typecheck` script) must pass with zero errors
- No `.js` extension additions to imports (keeps diff minimal)

---

### Task 1: Update `tsconfig.json` (root) - remove `baseUrl`

**Files:**
- Modify: `tsconfig.json:3`

**Interfaces:**
- Consumes: nothing
- Produces: clean root tsconfig without deprecations

- [ ] **Step 1: Remove `baseUrl` from tsconfig.json**

Edit `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@app/*": ["./src/app/*"],
      "@shared/*": ["./src/shared/*"],
      "@shared-core/*": ["./shared/*"],
      "@electron/*": ["./electron/*"],
      "@ui/*": ["./src/shared/ui/*"],
      "@features/*": ["./src/features/*"],
      "@platform/*": ["./src/platform/*"]
    }
  },
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.node.json"
    },
    {
      "path": "./tsconfig.node.test.json"
    }
  ]
}
```

(`baseUrl` and `paths` are both under `compilerOptions`; `baseUrl` is the line `"baseUrl": ".",` that gets removed. `paths` stays unchanged — in TS6, paths resolve relative to tsconfig directory, which is `.`, same as before.)

- [ ] **Step 2: Verify root config is valid JSON**

Run: `npx tsc -p tsconfig.json --noEmit 2>&1`
Expected: No errors (root config only has references, nothing compiles directly)

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: remove deprecated baseUrl from root tsconfig"
```

---

### Task 2: Update `tsconfig.app.json` - remove `baseUrl`, add `types: ["node"]`

**Files:**
- Modify: `tsconfig.app.json:1-37`

**Interfaces:**
- Consumes: nothing
- Produces: clean app tsconfig — no deprecation warnings, `NodeJS.Timeout` type available in renderer

- [ ] **Step 1: Remove `baseUrl` and add `types: ["node"]`**

Edit `tsconfig.app.json` — remove `"baseUrl": ".",` line (line 24), add `"types": ["node"]` under compilerOptions:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "tsBuildInfoFile": "./.cache/tsconfig.app.tsbuildinfo",
    "noFallthroughCasesInSwitch": true,
    "allowJs": false,
    "types": ["node"],
    "paths": {
      "@app/*": ["./src/app/*"],
      "@shared/*": ["./src/shared/*"],
      "@shared-core/*": ["./shared/*"],
      "@electron/*": ["./electron/*"],
      "@ui/*": ["./src/shared/ui/*"],
      "@features/*": ["./src/features/*"],
      "@platform/*": ["./src/platform/*"]
    }
  },
  "include": ["src", "shared"]
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run typecheck 2>&1`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add tsconfig.app.json
git commit -m "chore: remove baseUrl, add types for node in app tsconfig"
```

---

### Task 3: Update `tsconfig.node.json` - remove `baseUrl`, change `moduleResolution`, add `types`

**Files:**
- Modify: `tsconfig.node.json:1-32`

**Interfaces:**
- Consumes: Task 1 (root tsconfig) is a reference parent
- Produces: clean node tsconfig — no deprecation warnings, NodeJS globals available

- [ ] **Step 1: Migrate tsconfig.node.json**

Changes needed:
- Remove `"baseUrl": ".",` (line 15)
- Change `"moduleResolution": "Node"` → `"moduleResolution": "Bundler"` (line 6)
- Remove `"esModuleInterop": true` (line 14) — true by default in TS6
- Add `"types": ["node"]` for NodeJS global types

Final file:
```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Bundler",
    "skipLibCheck": false,
    "allowSyntheticDefaultImports": true,
    "allowJs": false,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "tsBuildInfoFile": "./.cache/tsconfig.node.tsbuildinfo",
    "types": ["node"],
    "paths": {
      "@app/*": ["./src/app/*"],
      "@shared/*": ["./src/shared/*"],
      "@shared-core/*": ["./shared/*"],
      "@electron/*": ["./electron/*"],
      "@ui/*": ["./src/shared/ui/*"],
      "@features/*": ["./src/features/*"],
      "@platform/*": ["./src/platform/*"]
    },
    "outDir": "dist/electron",
    "rootDir": ".",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["electron/**/*", "shared/**/*", "src/shared/lib/logger.ts"],
  "exclude": ["electron/**/__tests__/**/*", "electron/__tests__/**/*"]
}
```

- [ ] **Step 2: Verify backend compilation + build**

Run: `npm run build:backend 2>&1`
Expected: `tsc -b tsconfig.node.json --force` succeeds, esbuild succeeds

Run: `npm run typecheck 2>&1`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add tsconfig.node.json
git commit -m "chore: migrate node tsconfig to TS6 (bundler resolution, types)"
```

---

### Task 4: Update `package.json` - bump TypeScript version

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: Tasks 1-3 (tsconfigs already clean)
- Produces: project using TS 6.0.3

- [ ] **Step 1: Bump typescript version**

Edit `package.json` — change `"typescript": "^5.9.3"` to `"typescript": "^6.0.3"`

- [ ] **Step 2: Install**

Run: `npm install 2>&1`
Expected: typescript@6.0.3 installed

- [ ] **Step 3: Run full typecheck**

Run: `npm run typecheck 2>&1`
Expected: No errors, zero deprecation warnings

- [ ] **Step 4: Run existing tests**

Run: `npm test 2>&1`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade typescript from 5.9.3 to 6.0.3"
```

---

### Task 5: Verify full project health

- [ ] **Step 1: Run full typecheck across all configs**

Run: `npx tsc -b 2>&1`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `npm run lint 2>&1`
Expected: No new lint errors (existing warnings only)

- [ ] **Step 3: Run test suite**

Run: `npm test 2>&1`
Expected: All tests pass

- [ ] **Step 4: Spot-check critical imports**

Verify `NodeJS.Timeout` and `NodeJS.ErrnoException` resolve correctly in these files:
- `electron/app/index.ts`
- `electron/features/native-messaging/nativeMessagingManager.ts`
- `electron/core/cacheCleanup/idle.ts`
- `src/shared/hooks/webview/useWebviewCrasher.ts`

Run: `npx tsc -p tsconfig.node.json --noEmit 2>&1`
Expected: No errors

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1`
Expected: No errors

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "chore: final fixes after TS6 migration validation"
```
