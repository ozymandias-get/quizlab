# Task 1: Update shared types + i18n

**Files:**

- Modify: `shared/types/native-messaging.ts`
- Modify: `src/shared/i18n/locales/en/gws.json`
- Modify: `src/shared/i18n/locales/tr/gws.json`

**Interfaces:**

- Consumes: none (foundation task)
- Produces: updated `NativeMessagingExtensionInfo` with `waitingSince` + `userHint`; new i18n keys

### Step 1: Add `waitingSince` and `userHint` to the shared type

Edit `shared/types/native-messaging.ts`:

```typescript
export interface NativeMessagingExtensionInfo {
  status: NativeMessagingConnectionStatus
  installed: boolean
  error?: string
  /** Timestamp (ms) when the connecting state began, or null. */
  waitingSince: number | null
  /** Localized hint text shown to the user when waiting. */
  userHint: string | null
}
```

### Step 2: Add i18n keys for EN locale

Edit `src/shared/i18n/locales/en/gws.json` — add after line 79 (after `gws_extension_status_error`):

```json
  "gws_extension_status_waiting": "Waiting for Chrome extension connection... Make sure Chrome is running and the extension is enabled.",
  "gws_extension_status_waiting_long": "Still waiting. Open chrome://extensions and verify the Quizlab extension is enabled and loaded.",
  "gws_extension_status_not_installed": "Extension not installed.",
```

### Step 3: Add i18n keys for TR locale

Edit `src/shared/i18n/locales/tr/gws.json` — add after line 79:

```json
  "gws_extension_status_waiting": "Chrome eklentisi bekleniyor... Chrome'un açık olduğundan ve eklentinin etkin olduğundan emin olun.",
  "gws_extension_status_waiting_long": "Hala bekleniyor. chrome://extensions sayfasını açıp Quizlab eklentisinin etkin olduğunu kontrol edin.",
  "gws_extension_status_not_installed": "Eklenti yüklü değil.",
```

### Step 4: Verify with typecheck

Run: `npx tsc -b --noEmit` — expected: no errors (the new fields are optional so existing consumers don't break).
