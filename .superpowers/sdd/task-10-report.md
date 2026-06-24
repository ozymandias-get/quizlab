# Task 10: Harden Electron Builder Configuration

**Status:** ✅ Complete

## Changes Made

**File:** `package.json` (NSIS builder section)

| Setting                    | Before  | After   | Rationale                                      |
| -------------------------- | ------- | ------- | ---------------------------------------------- |
| `allowElevation`           | `true`  | `false` | Don't auto-request admin privileges on install |
| `deleteAppDataOnUninstall` | `false` | `true`  | Clean up app data when user uninstalls         |

## Commit

```
51ef117 fix(security): harden NSIS config — disable elevation, delete app data on uninstall
```

## Verification

- ✅ `allowElevation` changed from `true` to `false`
- ✅ `deleteAppDataOnUninstall` changed from `false` to `true`
- ✅ JSON syntax valid (no structural changes)
- ✅ Package still valid (no new dependencies or structural breakage)
