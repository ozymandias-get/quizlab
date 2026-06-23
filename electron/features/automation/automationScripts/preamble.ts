import type { SerializedAutomationConfig } from '../scripts/config'
import { buildCommonHelpers } from './runtimeHelpers'

type ScriptKind = 'focus' | 'auto_send' | 'click_send' | 'validate' | 'submit_ready'

function createScriptPreamble(
  kind: ScriptKind,
  config: SerializedAutomationConfig,
  includeButton = false
) {
  const ambiguousSelectorBehavior =
    kind === 'auto_send' || kind === 'click_send' ? 'pick' : 'reject'
  return `
    (async function() {
        ${buildCommonHelpers(ambiguousSelectorBehavior)}
        const scriptStartedAt = now();
        const config = ${JSON.stringify(config)};
        const diagnostics = createDiagnostics('${kind}', {
            inputSelector: uniqueStrings(config.input.selectors).join(', '),
            includeButton: ${includeButton},
            buttonSelector: uniqueStrings(config.button.selectors).join(', ')
        });
    `
}

function normalizeMs(value: unknown, fallback: number, min?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  if (typeof min === 'number') return Math.max(rounded, min)
  return rounded
}

export { createScriptPreamble, normalizeMs }
