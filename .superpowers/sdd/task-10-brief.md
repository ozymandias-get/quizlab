# Task 10: Extract splash.html inline JavaScript

**Files:**

- Modify: `src/public/splash.html`
- Create: `src/public/scripts/splash.js`

## Steps

### Step 1: Read current splash.html

Read `src/public/splash.html`. The `<script>` block at the end (after the SVG and CSS were already extracted in Tasks 2 and 3) contains JavaScript that:

1. Detects user language
2. Updates status/subtitle text with localized content
3. Shows build version from URL params
4. Handles quit button (localization, show after delay, close on click)

### Step 2: Create splash.js

Create `src/public/scripts/splash.js` with the JavaScript code extracted from the `<script>` block. The script content is:

```javascript
;(function () {
  const userLanguage = navigator.language || navigator.userLanguage
  document.documentElement.lang = userLanguage.startsWith('tr') ? 'tr' : 'en'
  const statusElement = document.getElementById('status-text')
  const subtitleElement = document.getElementById('subtitle-text')
  const buildTextElement = document.getElementById('build-text')

  const copy = userLanguage.startsWith('tr')
    ? {
        status: 'Öğrenme Ortamı Başlatılıyor',
        subtitle: 'Yapay Zeka Destekli Çalışma Alanı'
      }
    : {
        status: 'Bootstrapping Learning Workspace',
        subtitle: 'AI-Powered Study Environment'
      }

  if (statusElement) {
    statusElement.textContent = copy.status
  }
  if (subtitleElement) {
    subtitleElement.textContent = copy.subtitle
  }
  if (buildTextElement) {
    const params = new URLSearchParams(window.location.search)
    const appVersion = params.get('version')
    buildTextElement.textContent = appVersion ? 'v' + appVersion : 'v0.0.0'
  }

  const quitBtn = document.getElementById('quit-btn')
  if (quitBtn) {
    if (userLanguage.startsWith('tr')) {
      quitBtn.textContent = 'Çıkış Yap'
    }
    setTimeout(function () {
      quitBtn.classList.add('visible')
    }, 5600)
    quitBtn.addEventListener('click', function () {
      window.close()
    })
  }
})()
```

### Step 3: Update splash.html

Replace the `<script>...</script>` block with:

```html
<script src="scripts/splash.js"></script>
```

### Step 4: Verify

Open splash.html in a browser and confirm it still works (text localizes, build version shows, quit button appears after delay).

### Step 5: Commit

```bash
git add src/public/splash.html src/public/scripts/splash.js
git commit -m "refactor: extract inline JS from splash.html into separate file"
```
