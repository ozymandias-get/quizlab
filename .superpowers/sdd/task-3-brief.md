# Task 3: Extract CSS from splash.html into separate stylesheet

**Files:**

- Modify: `src/public/splash.html`
- Create: `src/public/styles/splash.css`

## Steps

### Step 1: Create `src/public/styles/splash.css`

Extract all CSS content from the `<style>` block in `src/public/splash.html` (lines 15-315, from `:root {` to the closing `</style>`).

The CSS content starts at line 15 (inside `<style>` tags):

```css
:root {
  --bg: #000000;
  --surface: rgba(7, 14, 24, 0.72);
  ...
```

And ends at line 315 with:

```css
.quit-btn:active {
  transform: translateX(-50%) scale(0.96);
}
```

Note: The CSS is indented inside the HTML `<style>` block. The extracted CSS file should have the indentation cleaned up to be proper standalone CSS (use consistent 2-space indentation or no indentation as appropriate). Do NOT include the `<style>` tags.

### Step 2: Update splash.html

Replace the entire `<style>...</style>` block (lines 14-316) with a `<link>` tag:

```html
<link rel="stylesheet" href="styles/splash.css" />
```

### Step 3: Verify

Open splash.html in a browser and verify styling matches the original (all classes, animations, layout preserved).

### Step 4: Commit

```bash
git add src/public/splash.html src/public/styles/splash.css
git commit -m "refactor: extract inline CSS from splash.html into separate stylesheet"
```
