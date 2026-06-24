# Task 1 Report: Extract tsParticles config from sparkles.tsx

## What I Implemented

Extracted the large inline `ISourceOptions` config object from `SparklesCore` component into a dedicated `createSparklesOptions()` function in a new file `sparklesConfig.ts`.

### Files Changed

- **Created:** `src/app/components/ui/sparklesConfig.ts` — new file with `createSparklesOptions(background, particleColor, particleDensity, minSize, maxSize, speed): ISourceOptions`
- **Modified:** `src/app/components/ui/sparkles.tsx` — replaced inline options object with call to `createSparklesOptions()` imported from `./sparklesConfig`

### What I Tested

1. **TypeScript compilation:** `npx tsc --noEmit` passed with no errors.
2. **Pre-commit hooks:** ESLint passed (added `eslint-disable-next-line` comments for two existing `as any` casts that were carried over from original code). Prettier passed.

## Self-Review Findings

- The config file preserves the exact same tsParticles configuration as the original inline object — no behavioral change.
- Both `as any` casts (on `move.attract` rotate values and the `move` object itself) are preserved from original code with eslint suppression comments.
- The function signature uses positional parameters matching the original usage order. This is fine since it's an internal-only function.
- `sparkles.tsx` shrank from 436 lines to 66 lines. `sparklesConfig.ts` is 157 lines. Total net lines unchanged.

## Issues or Concerns

- The `as any` casts and eslint suppressions are carryovers from the original code, not introduced by this refactor. They could be cleaned up in a follow-up if someone wants to properly type the tsParticles move config.
- Pre-existing non-blocking warnings from repo hygiene checks (file size limits on other files, missing CSS files for stylelint) are unrelated.
