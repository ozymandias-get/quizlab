### Task 8: Tighten Session Import File Type Validation

**Files:**

- Modify: `electron/features/gemini-web-session/handlers.ts:159-192`
- Modify: `electron/features/gemini-web-session/sessionExportImport.ts`

- [ ] **Step 1: Restrict import dialog to `.enc` files only**

In `electron/features/gemini-web-session/handlers.ts`, in the `GEMINI_WEB_IMPORT_SESSION` handler (~lines 159-192), change the dialog filters:

```typescript
// BEFORE:
const { canceled, filePaths } = win
  ? await dialog.showOpenDialog(win, {
      title: 'Import Gemini Session',
      filters: [
        { name: 'Session files', extensions: ['enc', 'json'] },
        { name: 'All files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
  : await dialog.showOpenDialog({
      title: 'Import Gemini Session',
      filters: [
        { name: 'Session files', extensions: ['enc', 'json'] },
        { name: 'All files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

// AFTER:
const { canceled, filePaths } = win
  ? await dialog.showOpenDialog(win, {
      title: 'Import Gemini Session',
      filters: [{ name: 'Encrypted Session', extensions: ['enc'] }],
      properties: ['openFile']
    })
  : await dialog.showOpenDialog({
      title: 'Import Gemini Session',
      filters: [{ name: 'Encrypted Session', extensions: ['enc'] }],
      properties: ['openFile']
    })
```

- [ ] **Step 2: Add server-side file extension validation in importSession**

In `electron/features/gemini-web-session/sessionExportImport.ts`, find the `importSession` method and add an early check:

Look for a method like:

```typescript
async importSession(filePath: string): Promise<{ success: boolean; error?: string; status?: GeminiWebSessionStatus }> {
```

Add at the top:

```typescript
// SECURITY: Only .enc files are allowed for import
if (!filePath.toLowerCase().endsWith('.enc')) {
  return { success: false, error: 'Only .enc files can be imported for security reasons' }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --force`
Expected: Exit code 0 (ignore pre-existing normalizePdfText.ts error)

- [ ] **Step 4: Commit**

Run: `git add electron/features/gemini-web-session/handlers.ts electron/features/gemini-web-session/sessionExportImport.ts && git commit -m "fix(security): restrict session import to .enc files only"`
