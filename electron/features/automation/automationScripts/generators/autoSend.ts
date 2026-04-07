import type { AutomationConfig } from '@shared-core/types'
import { serializeAutomationConfig } from '../../scripts/config'
import { buildSetInputValueScript } from '../../scripts/setInputValue'
import { buildPerformSubmitScript } from '../../scripts/submit'
import { createScriptPreamble } from '../preamble'

const generateAutoSendScript = (
  config: AutomationConfig,
  text: string,
  shouldSubmit: boolean = true,
  appendMode: boolean = false
): string => {
  const serialized = serializeAutomationConfig(config)
  const safeText = JSON.stringify(text)
  const performSubmitScript = buildPerformSubmitScript({ includeInputLookupForEnter: false })

  return `
    ${createScriptPreamble('auto_send', serialized, true)}
        const APPEND_TEXT_MODE = ${appendMode ? 'true' : 'false'};

${buildSetInputValueScript()}

${performSubmitScript}

        try {
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, 10000, false);
            const inputElement = inputResult.element;
            if (!inputElement) {
                const error = resolveLookupError(config.input, 'input_not_found', config.health);
                return {
                    success: false,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            await setInputValue(inputElement, ${safeText});
            if (!${shouldSubmit}) {
                return {
                    success: true,
                    action: 'input_only',
                    mode: config.submitMode,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                };
            }

            await wait(500);
            const submitResult = await performSubmit(inputElement);
            return {
                success: submitResult.success,
                mode: config.submitMode,
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    submitResult.success ? null : (submitResult.error || 'submit_failed')
                ),
                ...(submitResult.success ? {} : { error: submitResult.error || 'submit_failed' })
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'script_failed',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'script_failed'
                )
            };
        }
    })();
    `
}

export { generateAutoSendScript }
