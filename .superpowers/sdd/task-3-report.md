# Task 3 Report: Extract CSS from splash.html into separate stylesheet

## What I implemented

- Extracted the inline `<style>` block (~300 lines of CSS) from `src/public/splash.html` into a new standalone file `src/public/styles/splash.css`
- Replaced the `<style>...</style>` block with a `<link rel="stylesheet" href="styles/splash.css" />` tag in the HTML

## Files changed

- `src/public/splash.html` — removed inline `<style>` block, added `<link>` tag (302 lines removed)
- `src/public/styles/splash.css` — new file with all CSS (300 lines)

## Self-review findings

- All CSS selectors, properties, custom properties, keyframe animations, and pseudo-elements preserved 1:1
- CSS indentation cleaned up: top-level selectors at 0 indent, properties at 2 spaces (was 6/8 spaces inside `<style>` block)
- Pre-commit hook ran prettier on the files — no formatting issues
- Stylelint found no matching files to lint (expected, first CSS file in project)
- No CSS class names or HTML structure were altered, so visual rendering should be identical

## Issues or concerns

- None
