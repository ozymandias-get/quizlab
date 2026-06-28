### Task 3: Wire wizard into useGeminiWebSessionState and ExtensionStatusCard

**Files:**

- Modify: `src/features/settings/ui/geminiWebSession/useGeminiWebSessionState.ts`
- Modify: `src/features/settings/ui/geminiWebSession/GeminiWebSessionOverview.tsx`
- Modify: `src/features/settings/ui/geminiWebSession/components/ExtensionStatusCard.tsx`

**Context:** The `useGeminiWebSessionState` hook currently uses `alert()` for extension install/remove. We need to replace this with wizard state management. `ExtensionStatusCard` renders install/remove buttons. `GeminiWebSessionOverview` renders the whole settings panel.

**Existing code patterns:**

- `useGeminiWebSessionState` returns `t`, `status`, `riskItems`, `mitigationItems`, `actionState`, `handlers`
- `handlers.onInstallExtension` currently calls `installExtensionMutation()` and shows `alert()`
- `handlers.onRemoveExtension` currently calls `removeExtensionMutation()`
- `ExtensionStatusCard` receives `t`, `onInstallExtension`, `onRemoveExtension` as props
- `GeminiWebSessionOverview` receives `t`, `status`, `handlers`, etc. as props and renders `ExtensionStatusCard`

**Interfaces:**

- Consumes: `ExtensionWizardDialog` component from Task 2
- Produces: Working wizard flow - clicking Install/Remove opens wizard, wizard completion calls mutations

**Steps:**

1. **Update `useGeminiWebSessionState.ts`:**
   - Add wizard state: `wizardOpen`, `wizardMode`, `closeWizard`
   - Change `onInstallExtension` to just open wizard (set wizardMode='install', wizardOpen=true) instead of calling mutation
   - Change `onRemoveExtension` to just open wizard (set wizardMode='remove', wizardOpen=true)
   - Return `wizardOpen`, `wizardMode`, `closeWizard` from the hook

2. **Update `GeminiWebSessionOverview.tsx`:**
   - Import `ExtensionWizardDialog` from `./components`
   - Render `ExtensionWizardDialog` in the component, passing props:
     - `open={wizardOpen}`, `mode={wizardMode}`, `riskItems`, `mitigationItems`, `installedPath={null}`
     - `onInstall`: calls `installExtensionMutation` (from props or passed through)
     - `onRemove`: calls `removeExtensionMutation`
     - `onClose`: closes wizard
   - Thread the wizard state and mutation callbacks through component props

3. **No changes needed to `ExtensionStatusCard.tsx`** - it already calls `onInstallExtension`/`onRemoveExtension` from props, which now just open the wizard.

4. **Update `GeminiWebSessionOverviewProps`** interface to include wizard state if needed.

5. **Verify TypeScript compiles** with `npx tsc --noEmit --pretty`

6. **Commit** with message `"feat: wire ExtensionWizardDialog into settings UI"`
