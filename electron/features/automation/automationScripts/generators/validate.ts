import type { AutomationConfig } from '@shared-core/types'
import { serializeAutomationConfig } from '../../scripts/config'
import { createScriptPreamble } from '../preamble'

const generateValidateSelectorsScript = (config: AutomationConfig): string => {
  const serialized = serializeAutomationConfig(config)

  return `
    ${createScriptPreamble('validate', serialized, true)}
        try {
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, 2000, false);
            const buttonResult = await waitForElement(config.button, 'button', diagnostics.button, 2000, true);
            const inputFound = Boolean(inputResult.element);
            const buttonFound = Boolean(buttonResult.element);
            const error = !inputFound
                ? resolveLookupError(config.input, 'input_not_found', config.health)
                : (!buttonFound ? resolveLookupError(config.button, 'button_not_found', config.health) : null);

            return {
                success: inputFound && buttonFound,
                action: 'validate',
                mode: config.submitMode,
                diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error),
                ...(error ? { error } : {})
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'validate_failed',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'validate_failed'
                )
            };
        }
    })();
    `
}

export { generateValidateSelectorsScript }
