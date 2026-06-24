# Task 1: Re-enable Site Isolation & Remove `disable-site-isolation-trials`

## What was implemented

Removed `app.commandLine.appendSwitch('disable-site-isolation-trials')` from `electron/app/index.ts:35`. This re-enables Chromium's Site Isolation (Spectre mitigation) for all renderer processes.

## Files changed

- `electron/app/index.ts` — removed one line

## What was tested and test results

- Ran `npx tsc -b --force` — build failed with a **pre-existing** TS error in `src/features/pdf/text/normalizePdfText.ts:57` (unrelated to this change). The error is an implicit `any` index type issue in a PDF text normalization function. My change does not introduce or affect this error.

## Self-review findings

- The `disable-site-isolation-trials` switch was cleanly removed with no remaining references in the file.
- No other files reference this switch.
- The pre-existing TS error should be addressed separately for a clean build.

## Issues or concerns

- Pre-existing TS error in `normalizePdfText.ts` prevents a clean `tsc -b --force` exit code 0. This was not introduced by this task.
