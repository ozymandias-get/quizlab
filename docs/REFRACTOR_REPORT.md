# REFRACTOR_REPORT

## 1) Final Directory Tree

### Top-level (key folders)
```text
quizlab/
  electron/
    app/
    core/
    features/
    preload/
    __tests__/
  shared/                  # cross-process shared (unchanged purpose)
    constants/
    types/
  src/
    app/
      effects/
      hooks/
      providers/
    features/
      ai/{api,hooks,model,ui}
      pdf/{hooks,model,ui}
      quiz/{api,hooks,model,ui}
      settings/{hooks,model,ui}
      screenshot/{hooks,model,ui}
      automation/{hooks,model,ui}
      tutorial/{hooks,model,ui}
    shared/
      ui/{components,layout}
      hooks/
      lib/
      constants/
      i18n/locales/
      styles/
      types/
    platform/electron/{api,useElectron.ts}
    public/
    __tests__/
    index.html
    vite-env.d.ts
```

### `src/` (actual)
```text
src/
  app/
  features/
  platform/
  public/
  shared/
  __tests__/
  index.html
  vite-env.d.ts
```

## 2) Important Alias Changes

- `@app/*` -> `src/app/*` (new)
- `@features/*` -> `src/features/*` (kept)
- `@platform/*` -> `src/platform/*` (kept)
- `@ui/*` -> `src/shared/ui/*` (moved from old `src/components/ui/*`)
- `@shared/*` -> `src/shared/*` (renderer-shared)
- `@shared-core/*` -> `shared/*` (new alias for repo-root cross-process shared)
- `@electron/*` -> `electron/*` (kept)
- `@src/*` -> removed

Configs updated:
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `vite.config.mts`
- `vitest.config.mts`

## 3) Old -> New Mapping (major)

- `src/components/layout/*` -> `src/shared/ui/layout/*`
- `src/components/ui/*` -> `src/shared/ui/components/*`
- `src/components/ui/ScreenshotTool.tsx` -> `src/features/screenshot/ui/ScreenshotTool.tsx`
- `src/components/ui/ConfettiCanvas.tsx` -> `src/features/quiz/ui/ConfettiCanvas.tsx`
- `src/hooks/*` -> `src/shared/hooks/*`
- `src/utils/*` -> `src/shared/lib/*`
- `src/constants/*` -> `src/shared/constants/*` (except translations)
- `src/constants/translations.ts` -> `src/shared/i18n/translations.ts`
- `src/locales/*` -> `src/shared/i18n/locales/*`
- `src/styles/*` -> `src/shared/styles/*`
- `src/types/global.d.ts` -> `src/shared/types/global.d.ts`
- `src/features/pdf/components/*` -> `src/features/pdf/ui/components/*`
- `src/features/pdf/components/hooks/*` -> `src/features/pdf/ui/hooks/*`
- `src/features/ai/components/*` -> `src/features/ai/ui/*`
- `src/features/quiz/components/*` -> `src/features/quiz/ui/*`
- `src/features/settings/components/*` -> `src/features/settings/ui/*`
- `src/features/tutorial/components/*` -> `src/features/tutorial/ui/*`
- `electron/main/*` -> `electron/app/*`

## 4) Feature Public API Standardization

Added root public entry files:
- `src/features/ai/index.ts`
- `src/features/pdf/index.ts`
- `src/features/quiz/index.ts`
- `src/features/settings/index.ts`
- `src/features/screenshot/index.ts`
- `src/features/automation/index.ts`
- `src/features/tutorial/index.ts`

Added model/public files:
- `src/features/ai/model/types.ts`
- `src/features/quiz/model/{types.ts,constants.ts,index.ts}`
- `src/features/quiz/ui/constants.ts`
- `src/features/{pdf,settings,screenshot,automation,tutorial}/model/index.ts`

Cross-feature imports were moved to feature-root imports (`@features/<feature>`) in app and feature boundaries.

## 5) Commands Run and Results

- `npm run typecheck` -> PASS
- `npm run lint` -> PASS
- `npx vitest run` -> PASS (55 files, 266 tests)
- `npm run build:renderer:electron` -> PASS
- `npm run build:backend` -> PASS
- `npm run build` -> PASS

Additional checks:
- `rg -n "@src/" src electron shared` -> no matches
- `rg -n "main/constants" electron` -> no matches

## 6) Guardrails

- ESLint command added:
  - `npm run lint` -> `eslint . --ext .ts,.tsx --max-warnings=0`
- Alias policy guardrails:
  - `@src/*` imports are forbidden.
  - `@shared/*` reserved for renderer shared (`src/shared/*`).
  - `@shared-core/*` reserved for repo-root shared contracts (`shared/*`).
- Feature boundary guardrails:
  - Outside `src/features/**`, deep imports to `@features/*/ui/*`, `@features/*/model/*`, `@features/*/api/*` are forbidden.
  - Public imports via `@features/<feature>` are allowed.
- Shared-core safety guardrails (`shared/**`):
  - Warn on Electron module imports (`electron`, `electron/*`, `@electron/*`).
  - Warn on DOM globals (`window`, `document`).
- Reference doc added:
  - `docs/ARCHITECTURE.md`
- Documentation formatting rule:
  - To prevent GitHub mention-like rendering, aliases must be written in backticks (for example, ``@shared/*``).

## 7) How to Run Checks

```bash
npm run typecheck
npm run lint
npx vitest run
npm run build
```

## 8) Known Risks / Debt

- Vite warning remains during renderer build:
  - `src/features/pdf/index.ts` is dynamically imported in `LeftPanel` and also statically imported in `src/app/App.tsx`.
  - This affects chunk-splitting behavior, not runtime correctness.
- `design/button-redesign.html` was already deleted before refactor (user-confirmed as non-critical).

## 9) Remote Policy

- Post-refactor guardrail stabilization changes were applied locally only.
