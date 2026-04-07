import type { AutomationConfig } from '@shared-core/types'
import { serializeAutomationConfig } from '../../scripts/config'
import { buildPerformSubmitScript } from '../../scripts/submit'
import { createScriptPreamble } from '../preamble'

const generateClickSendScript = (config: AutomationConfig): string => {
  const serialized = serializeAutomationConfig(config)
  const performSubmitScript = buildPerformSubmitScript({ includeInputLookupForEnter: true })

  return `
    ${createScriptPreamble('click_send', serialized, true)}
${performSubmitScript}

        try {
            const submitResult = await performSubmit();
            return {
                success: submitResult.success,
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
                error: error instanceof Error ? error.message : 'click_failed',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'click_failed'
                )
            };
        }
    })();
    `
}

export { generateClickSendScript }
