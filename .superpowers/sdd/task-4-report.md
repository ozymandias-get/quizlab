# Task 4 Report: ExtensionStatusCard.tsx — Updated UI

## Implementation

Replaced the ExtensionStatusCard component to show fine-grained connection states using the new `userHint` field.

### States implemented

- `installed=true` + `connected` → green dot, "Extension connected"
- `installed=true` + `connecting` + `userHint='waiting'` → amber dot, "Waiting for Chrome extension..."
- `installed=true` + `connecting` + `userHint='waiting_long'` → amber dot, "Still waiting. Open chrome://extensions..."
- `installed=true` + `connecting` + `userHint=null` → amber dot, "Extension connecting..."
- `installed=false` + any → white dot, "Extension not installed."

### Key changes

- Removed `EXTENSION_STATUS_KEYS` constant
- Added `statusKey()` function that reads `info.userHint` for fine-grained status text
- Added `dotColor()` function to decouple dot rendering from status text

## Files Changed

- `src/features/settings/ui/geminiWebSession/components/ExtensionStatusCard.tsx` — full replacement
- `.superpowers/sdd/progress.md` — updated with Task 3 completion entry (pre-staged)
- `.superpowers/sdd/task-4-brief.md` — replaced with correct Task 4 brief (pre-staged)

## Typecheck Result

No new errors. Pre-existing errors (6) in unrelated files (`useApiChatPage.ts`, `ApiChatPage.tsx`, `automationScripts.test.ts`).

## Self-Review Findings

- All 5 required states are correctly mapped
- `dotColor()` renders green/amber/white per spec
- Install/remove button logic unchanged
- Polling interval unchanged (5s)
- ESLint/prettier passed via pre-commit hooks

## Concerns

None. The replacement is a straightforward swap of the status key resolution strategy from a static map to a `userHint`-aware function.
