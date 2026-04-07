import type { AutomationConfig } from '@shared-core/types'
import { serializeAutomationConfig } from '../../scripts/config'
import { createScriptPreamble } from '../preamble'

const generateFocusScript = (config: AutomationConfig): string => {
  const serialized = serializeAutomationConfig(config)

  return `
    ${createScriptPreamble('focus', serialized)}
        try {
            const result = await waitForElement(config.waitFor, 'input', diagnostics.input, 10000, false);
            const element = result.element;
            if (!element) {
                const error = resolveLookupError(config.waitFor, 'input_not_found', config.health);
                return {
                    success: false,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            element.focus();
            triggerLifecycleEvents(element);

            return {
                success: true,
                diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'focus_failed',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'focus_failed'
                )
            };
        }
    })();
    `
}

export { generateFocusScript }
