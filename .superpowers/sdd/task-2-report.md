# Task 2 Report: Extract splash.html SVG logo into separate file

## What was implemented

Extracted the inline SVG logo (~309 lines) from `src/public/splash.html` into a standalone SVG file at `src/public/icons/quizlab-logo.svg`. Replaced the inline `<svg>` element with an `<img>` tag referencing the new file.

## Files changed

- **Created:** `src/public/icons/quizlab-logo.svg` — standalone SVG file with proper xmlns wrapper
- **Modified:** `src/public/splash.html` — replaced 315 lines of inline SVG with `<img class="mark" src="icons/quizlab-logo.svg" alt="" aria-hidden="true" />`

## Self-review findings

- All SVG content (defs, gradients, filters, paths, shapes) preserved exactly from original
- SVG file uses proper `xmlns="http://www.w3.org/2000/svg"` attribute
- Image path (`icons/quizlab-logo.svg`) is relative to splash.html location, correct
- `aria-hidden="true"` preserved on the img tag for accessibility
- Pre-commit hooks passed (non-blocking warnings about pre-existing file size issues are unrelated)

## Issues or concerns

None. Clean mechanical refactoring.
