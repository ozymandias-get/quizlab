# Automation Script Assembly

This folder contains the modular implementation behind `../automationScripts.ts`.

- `generators/`: Action-specific script generators (`focus`, `autoSend`, `clickSend`, `submitReady`, `validate`).
- `preamble.ts`: Shared script preamble and numeric option normalization.
- `runtimeHelpers.ts`: Shared runtime helper block injected into generated scripts.

Assembly order is deterministic in each generator:

1. Common preamble and runtime helpers
2. Action-specific injected helpers (for example `setInputValue` / `performSubmit`)
3. Action body and result payload

`electron/features/automation/automationScripts.ts` remains the stable public API surface
for `automationHandlers.ts` and other consumers.
