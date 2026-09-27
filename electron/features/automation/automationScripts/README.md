# Automation Script Assembly

This folder contains the modular implementation behind `../automationScripts.ts`.

- `generators/`: Action-specific script generators (`focus`, `autoSend`, `clickSend`, `submitReady`, `validate`).
- `lib/`: Injected-runtime building blocks shared by the generators — the selector engine (`selectorEngine`), the site-strategy registry (`siteStrategyRegistry`), the recovery pipeline (`fallbackPipeline`), fingerprint and shadow-DOM search helpers, event-driven waiting, the runtime error classifier, and the selector-repair runtime. Like everything else here, these modules are string templates, not main-process code.
- `preamble.ts`: Shared script preamble and numeric option normalization.
- `runtimeHelpers.ts`: Shared runtime helper block injected into generated scripts.

Assembly order is deterministic in each generator:

1. Common preamble and runtime helpers
2. Action-specific injected helpers (for example `setInputValue` / `performSubmit`)
3. Action body and result payload

The generated scripts run inside the target `<webview>` via
`webContents.executeJavaScript`; they never persist anything. Only serializable
metadata crosses IPC. See `docs/ARCHITECTURE.md` for the selector self-healing
flow these modules implement.

`electron/features/automation/automationScripts.ts` remains the stable public API surface
for `automationHandlers.ts` and other consumers.
