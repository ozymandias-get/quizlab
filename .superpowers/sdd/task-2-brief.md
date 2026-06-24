# Task 2: Extract splash.html SVG logo into separate file

**Files:**

- Modify: `src/public/splash.html`
- Create: `src/public/icons/quizlab-logo.svg`

**Interfaces:**

- Consumes: Inline SVG markup from splash.html (lines 325-639)
- Produces: Standalone SVG file

## Steps

### Step 1: Create directory and SVG file

Create directory `src/public/icons/` and file `src/public/icons/quizlab-logo.svg` containing the complete SVG logo extracted from splash.html.

The SVG is everything inside the `<svg>` element in `src/public/splash.html` (lines 325-639). The SVG starts at line 325: `<svg class="mark" viewBox="0 0 1024 1024" ...>` and ends at line 639: `</svg>`.

The standalone SVG file should be wrapped in proper SVG with xmlns and other attributes:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">
  <!-- All the inner content from splash.html lines 332-638 -->
</svg>
```

### Step 2: Replace inline SVG in splash.html

Replace the entire `<svg>...</svg>` block (lines 325-639) with:

```html
<img class="mark" src="icons/quizlab-logo.svg" alt="" aria-hidden="true" />
```

### Step 3: Verify

Open splash.html in a browser to confirm the logo still displays correctly (the image path is relative to the HTML file location).

### Step 4: Commit

```bash
git add src/public/splash.html src/public/icons/quizlab-logo.svg
git commit -m "refactor: extract inline SVG logo from splash.html into separate file"
```
