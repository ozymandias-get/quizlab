### Task 10: Harden Electron Builder Configuration

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Disable installer elevation and enable data deletion on uninstall**

In `package.json`, find the `"nsis"` section (around lines 99-118) and make these changes:

```json
// Change these values in the nsis section:
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "allowElevation": false,          // was true — don't auto-request admin
  "installerIcon": "resources/icon.ico",
  "uninstallerIcon": "resources/icon.ico",
  "installerHeaderIcon": "resources/icon.ico",
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "Quizlab Reader",
  "include": "installer/installer.nsh",
  "installerLanguages": [
    "en_US",
    "tr_TR"
  ],
  "language": "1033",
  "warningsAsErrors": false,
  "runAfterFinish": true,
  "deleteAppDataOnUninstall": true   // was false — remove data on uninstall
}
```

- [ ] **Step 2: Commit**

Run: `git add package.json && git commit -m "fix(security): harden NSIS config — disable elevation, delete app data on uninstall"`
