# Task 10 Report: Extract splash.html inline JavaScript

## Status: DONE

## Files Changed

- **Created:** `src/public/scripts/splash.js` (42 lines) — extracted JavaScript wrapped in IIFE
- **Modified:** `src/public/splash.html` — replaced inline `<script>` block with `<script src="scripts/splash.js"></script>`

## Commit

- `8d543c6` — `refactor: extract inline JS from splash.html into separate file`

## Verification

- `splash.html`: inline script removed, external script tag added at line 46
- `splash.js`: contains all original logic wrapped in IIFE to avoid global scope pollution
  - Language detection and localization
  - Status/subtitle text update
  - Build version display from URL params
  - Quit button visibility and click handler

## Notes

- The original HTML used `const` at the top level (no IIFE). The extracted file wraps code in an IIFE, which is functionally identical since the script runs at the end of `<body>` and only accesses DOM elements and `navigator`/`window` globals.
- Pre-existing repo hygiene warnings (file size limits in unrelated source files) are not related to this change.
