# Major Dependency Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade 8 major-version npm packages (excluding pdfjs-dist) while maintaining zero test failures and clean type-checking.

**Architecture:** Each task bumps one package (or a logical group) and fixes any breaking changes. Tasks are ordered from lowest-to-highest risk. The working tree is dirty with uncommitted settings/PDF work — never commit that work, only the dependency upgrade changes.

**Tech Stack:** Node.js v24.13.0, TypeScript 6.0.3, ESLint 9.39.4, React 19, Vitest 4.1.9, Vite 8.1.0

## Global Constraints

- **Working tree is DIRTY** — do NOT commit work from other tasks/sessions. Only commit the dependency upgrade changes for your task.
- **Must maintain:** `npm test` passes (246/246 test files, 0 failures), `tsc -b` passes (pre-existing TS7053 in `normalizePdfText.ts` is allowed), `build:backend` succeeds
- **Must NOT update:** `pdfjs-dist` (version stays at `^3.11.174`)
- **Must NOT update:** TypeScript, Vite, Vitest, electron, esbuild, or any other non-listed package
- **Always run `npm install` before `npm test` after changing `package.json`**
- **Icon renames must be done with codemod first, then manually verify**

---

### Task 1: jscpd 4→5

**Files:**

- Modify: `package.json:199` (version)
- Modify: `package-lock.json` (via npm install)
- Config: `.jscpd.json` (no changes needed — same format)

**Interfaces:**

- Consumes: CLI script `"analyze:duplicates": "jscpd --reporters console"` in package.json
- Produces: jscpd v5 Rust binary installed, CLI-only usage works identically

This is the simplest upgrade. jscpd v5 is a Rust rewrite that accepts the same CLI flags. Project only uses jscpd via CLI (`analyze:duplicates` script). No Node.js API usage.

- [ ] **Step 1: Update package.json version**

Edit `package.json` line 199: change `"jscpd": "^4.2.4"` to `"jscpd": "^5.0.0"`

- [ ] **Step 2: Install and verify**

Run: `npm install`
Run: `npm run analyze:duplicates`
Expected: jscpd runs successfully (may produce different output format)

- [ ] **Step 3: Verify tests still pass**

Run: `npm test`
Expected: 246/246 files pass, 0 failures

### Task 2: @types/node 25→26

**Files:**

- Modify: `package.json` (version)
- Modify: `package-lock.json` (via npm install)

**Interfaces:**

- Consumes: TypeScript 6.0.3, Node.js v24.13.0
- Produces: Updated Node.js type definitions

v26 drops TS 5.5 support (we're on TS 6 ✅). Main changes: `module.register()` deprecated (use `registerHooks`), `exec()`/`execFile()` error interface has stricter `stdout`/`stderr` types (string | Buffer). Check if any code uses these patterns.

- [ ] **Step 1: Update package.json**

Change `"@types/node": "^25.9.2"` to `"@types/node": "^26.0.0"`

- [ ] **Step 2: Install and type-check**

Run: `npm install`
Run: `npx tsc -b`
Expected: Compiles with only the pre-existing TS7053 error

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 246/246 pass, 0 failures

- [ ] **Step 4: Commit**

### Task 3: jsdom 28→29

**Files:**

- Modify: `package.json` (version)
- Modify: `package-lock.json` (via npm install)

**Interfaces:**

- Consumes: Vitest 4.1.9 with jsdom environment
- Produces: Updated jsdom with new CSSOM implementation

Only breaking change is Node.js v22.13.0+ minimum (we have v24). CSSOM was rewritten (css-tree parser). Run tests to check for CSS parsing differences.

- [ ] **Step 1: Update package.json**

Search for `"jsdom":` in `package.json` and update from `"^28.1.0"` to `"^29.0.0"`

- [ ] **Step 2: Install and test**

Run: `npm install`
Run: `npm test`
Expected: 246/246 pass, 0 failures

- [ ] **Step 3: Commit**

### Task 4: eslint-plugin-unicorn 56→68

**Files:**

- Modify: `package.json` (version)
- Modify: `eslint.config.mjs:137,140` (rule changes)
- Modify: `package-lock.json` (via npm install)

**Interfaces:**

- Consumes: Existing eslint.config.mjs with unicorn rules
- Produces: Updated plugin version with corrected rule names

**Breaking changes to handle:**

1. `unicorn/better-regex` rule **removed** in v65 — must delete from config
2. `unicorn/no-instanceof-array` **deprecated** in v57 — replace with `unicorn/no-instanceof-builtins`
3. Plugin became pure ESM in v57 (already using flat config ✅)
4. ESLint 9.20+ required (on 9.39.4 ✅)

- [ ] **Step 1: Update package.json**

Change `"eslint-plugin-unicorn": "^56.0.1"` to `"eslint-plugin-unicorn": "^68.0.0"`

- [ ] **Step 2: Remove `better-regex` from eslint config**

In `eslint.config.mjs` line 137, remove the line:

```js
'unicorn/better-regex': 'error',
```

- [ ] **Step 3: Replace `no-instanceof-array` with `no-instanceof-builtins`**

In `eslint.config.mjs` line 140, change:

```js
'unicorn/no-instanceof-array': 'error',
```

to:

```js
'unicorn/no-instanceof-builtins': 'error',
```

- [ ] **Step 4: Install and lint**

Run: `npm install`
Run: `npx eslint . --max-warnings 1000` (check for new rule violations)
Expected: No errors from removed/deprecated rules

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: 246/246 pass, 0 failures

- [ ] **Step 6: Commit**

### Task 5: eslint-plugin-react-hooks 5→7

**Files:**

- Modify: `package.json` (version)
- Modify: `eslint.config.mjs:79` (may need config format update)
- Modify: `package-lock.json` (via npm install)

**Interfaces:**

- Consumes: Existing eslint.config.mjs with `'react-hooks': reactHooks`
- Produces: Updated plugin with new React Compiler rules (may need to be explicitly opted into or configured)

**Breaking changes:**

1. v6: Flat config is default `recommended` preset (legacy moved to `recommended-legacy`)
2. v7: `recommended-latest-legacy` and `flat/recommended` configs removed
3. v7: **React Compiler rules enabled by default in presets** — 14 new rules at `error` level
4. v7: Plugin is pure ESM, exports `configs.flat` for flat config

Current project only uses `rules-of-hooks` and `exhaustive-deps` explicitly. The new compiler rules (like `react-hooks/immutability`, `react-hooks/refs`, etc.) will NOT fire unless the preset is used — since the project lists individual rules rather than spreading a preset.

- [ ] **Step 1: Update package.json**

Change `"eslint-plugin-react-hooks": "^5.2.0"` to `"eslint-plugin-react-hooks": "^7.1.1"`

- [ ] **Step 2: Install**

Run: `npm install`

- [ ] **Step 3: Lint to check for any new issues**

Run: `npx eslint . --max-warnings 1000`
Expected: No new errors from hooks plugin. If errors appear related to the `recommended-latest` or `flat/recommended` configs, the project doesn't use presets so this should be clean.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 246/246 pass, 0 failures

- [ ] **Step 5: Commit**

### Task 6: lucide-react 0→1

**Files:**

- Modify: `package.json` (version)
- Modify: Multiple `*.tsx` files with icon renames (56 files import from lucide-react)
- Modify: `package-lock.json` (via npm install)

**Interfaces:**

- Consumes: All `import { IconName } from 'lucide-react'` statements in `src/`
- Produces: Updated icon names per v1 naming convention

**Breaking changes:**

1. Icon renames (shape-first): `AlertCircle` → `CircleAlert`, `CheckCircle2` → `CircleCheck`, `XCircle` → `CircleX`
2. Brand icons removed (not used in this project ✅)
3. `LucideIcon` is now type-only (used only as `import type { LucideIcon }` in one file — `src/features/pdf/ui/components/ContextMenu.tsx:1` — already imported as type)
4. `aria-hidden="true"` default (accessibility improvement ✅)
5. Codemod available: `npx @lucide/codemod@latest migrate-from-0.x`

- [ ] **Step 1: Update package.json**

Change `"lucide-react": "^0.563.0"` to `"lucide-react": "^1.21.0"`

- [ ] **Step 2: Run the official codemod**

Run: `npx @lucide/codemod@latest migrate-from-0.x`
This will automatically rename all icons across the project.

- [ ] **Step 3: Install updated package**

Run: `npm install`

- [ ] **Step 4: Type-check for any remaining issues**

Run: `npx tsc -b`
Expected: Zero type errors. If any icon names still don't resolve, manually check the rename table at https://lucide.dev/guide/react/migration.

- [ ] **Step 5: Check `LucideIcon` usage**

Read `src/features/pdf/ui/components/ContextMenu.tsx:1` and verify the import already has `type` keyword (it uses `import type { LucideIcon }` which is correct for v1).

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: 246/246 pass, 0 failures

- [ ] **Step 7: Commit**

### Task 7: lint-staged 16→17

**Files:**

- Modify: `package.json` (version)
- Modify: `package-lock.json` (via npm install)

**Interfaces:**

- Consumes: `lint-staged` config in `package.json`
- Produces: Updated lint-staged binary

This is the highest-uncertainty task — detailed changelog was rate-limited. lint-staged major releases typically drop old Node.js versions and may change config format. Check `.lintstagedrc` or `package.json` lint-staged config.

- [ ] **Step 1: Read current lint-staged config**

Grep for `lint-staged` or `lintstaged` in `package.json` and config files.

- [ ] **Step 2: Update package.json**

Change `"lint-staged": "^16.4.0"` to `"lint-staged": "^17.0.8"`

- [ ] **Step 3: Install**

Run: `npm install`

- [ ] **Step 4: Verify lint-staged works**

Run: `npx lint-staged --dry-run`
Expected: Runs without errors.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 246/246 pass, 0 failures

- [ ] **Step 6: Commit**

### Task 8: eslint 9→10

**Files:**

- Modify: `package.json` (version)
- Modify: `eslint.config.mjs` (may need updates for breaking changes)
- Modify: `package-lock.json` (via npm install)

**Interfaces:**

- Consumes: All eslint plugins, parser, and config
- Produces: ESLint v10 with flat config

**Breaking changes to handle:**

1. **Old eslintrc format removed** — already using flat config ✅
2. **Config lookup starts from linted file's directory** — if eslint is run from project root, this should match current behavior
3. **`eslint:recommended` updated** — 3 new rules: `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error`
4. **`/* eslint-env */` comments now error** — check if any exist
5. **New JSX reference tracking** — may catch previously missed issues
6. **`no-shadow-restricted-names` now reports `globalThis`** — check for violations
7. **`LintMessage.nodeType` removed** — only matters for custom formatters
8. **`Program` AST node range spans entire source** — only matters for custom rules
9. **Node.js v20.19+ required** (we have v24 ✅)
10. **`context.getCwd()` etc. removed** — only matters for custom rules

- [ ] **Step 1: Search for eslint-env comments**

Run: `rg 'eslint-env' --include='*.{ts,tsx,js,mjs}' src/ electron/ shared/`
Expected: No results. If found, remove or replace them.

- [ ] **Step 2: Update package.json**

Change `"eslint": "^9.39.4"` to `"eslint": "^10.5.0"`

- [ ] **Step 3: Install**

Run: `npm install`

- [ ] **Step 4: Lint and fix issues**

Run: `npx eslint . --max-warnings 1000`

Fix any new errors from:

- Updated `eslint:recommended` rules
- `no-shadow-restricted-names` with `globalThis`
- JSX reference tracking changes

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: 246/246 pass, 0 failures

- [ ] **Step 6: Commit**
