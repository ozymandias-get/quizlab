# Extension Installation Wizard Design

## Overview

Replace the current `alert()`-based extension install/uninstall flow in the Gemini Web Session settings with an aesthetic, step-based wizard dialog that shows risk warnings before installation and confirmation before removal.

## Current Flow

- Install: `alert()` with path + instructions, no confirmation
- Remove: silent deletion, no confirmation
- UI: browser-native `alert()` / `confirm()`

## Target Flow

### Install Wizard (4 steps)

1. **Risk Warning** — Detailed risk items (extracted from existing `riskItems`/`mitigationItems`) with numbered list, styled as a scrollable card
2. **Confirmation** — "I understand the risks, install anyway" button
3. **Installing** — Loading spinner + status text while mutation runs
4. **Complete** — Success checkmark + installed path + "Konum panoya kopyalandı" + manual instructions

### Remove Wizard (3 steps)

1. **Confirmation** — Warning that extension files will be deleted
2. **Removing** — Loading spinner + status text
3. **Complete** — Success checkmark + "Eklenti kaldırıldı"

## Implementation

### New Component: `ExtensionWizardDialog`

- Location: `src/features/settings/ui/geminiWebSession/components/ExtensionWizardDialog.tsx`
- Props: `open`, `mode` (`'install'` | `'remove'`), `riskItems`, `mitigationItems`, `t`, `onInstall`, `onRemove`, `onClose`
- Internal state: `step` (0-indexed), uses `AnimatePresence` + `motion` for step transitions
- Modal pattern follows `LanguageSelectionDialog` (scroll lock, focus trap, Escape handling, backdrop)

### Modification: `useGeminiWebSessionState.ts`

- Replace `alert()` calls with wizard state management
- Add `wizardMode`, `wizardOpen`, `setWizardOpen` state
- `onInstallExtension` opens wizard instead of calling mutation directly
- `onRemoveExtension` opens wizard instead of calling mutation directly
- Wizard completion triggers the actual mutation

### Modification: `ExtensionStatusCard.tsx`

- Pass wizard open handlers instead of direct install/remove calls

### New Translation Keys (`en/gws.json` + `tr/gws.json`)

- `gws_extension_wizard_risk_title` — "Security & Privacy Risks"
- `gws_extension_wizard_risk_desc` — "Review the following risks before installing the extension"
- `gws_extension_wizard_risk_list_title` — "Risks"
- `gws_extension_wizard_mitigation_title` — "Recommended Precautions"
- `gws_extension_wizard_confirm_label` — "I understand the risks, continue installation"
- `gws_extension_wizard_installing` — "Installing extension..."
- `gws_extension_wizard_install_success` — "Extension installed successfully"
- `gws_extension_wizard_path_copied` — "Path copied to clipboard"
- `gws_extension_wizard_manual_instructions` — "Manual steps to enable in Chrome"
- `gws_extension_wizard_done_btn` — "Done"
- `gws_extension_wizard_remove_title` — "Remove Extension"
- `gws_extension_wizard_remove_desc` — "This will delete the extension files from your computer."
- `gws_extension_wizard_remove_confirm` — "Yes, remove extension"
- `gws_extension_wizard_removing` — "Removing extension..."
- `gws_extension_wizard_remove_success` — "Extension removed successfully"
- `gws_extension_wizard_cancel` — "Cancel"

## Architecture

```
ExtensionStatusCard
  → opens wizard via handlers
    → ExtensionWizardDialog
      → step 0: risk display
      → step 1: confirm button
      → step 2: loading (calls mutation)
      → step 3: success/result
```

## States

- **Idle** — No wizard shown
- **Risk step** — Display risks, next button disabled until acknowledgment
- **Confirm step** — "Install" / "Remove" button
- **Loading step** — Spinner, no dismiss
- **Result step** — Success message, "Done" button to close
- **Error** — Error message + "Close" button
