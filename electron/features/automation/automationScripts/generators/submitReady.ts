import type { AutomationConfig } from '@shared-core/types'
import { serializeAutomationConfig } from '../../scripts/config'
import { createScriptPreamble, normalizeMs } from '../preamble'

const generateWaitForSubmitReadyScript = (
  config: AutomationConfig,
  options: { timeoutMs?: number; settleMs?: number; minimumWaitMs?: number } = {}
): string => {
  const serialized = serializeAutomationConfig(config)
  const timeoutMs = normalizeMs(options.timeoutMs, 15000, 1)
  const settleMs = normalizeMs(options.settleMs, 1200, 0)
  const minimumWaitMs = normalizeMs(options.minimumWaitMs, 1000, 0)

  return `
    ${createScriptPreamble('submit_ready', serialized, true)}
        try {
            const buttonConfigured = config.submitMode !== 'enter_key' && hasLookup(config.button);
            if (buttonConfigured && diagnostics.button) {
                diagnostics.button.interactiveRequired = true;
            } else {
                diagnostics.input.interactiveRequired = true;
            }
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, 10000, false);
            const inputElement = inputResult.element;

            if (!inputElement) {
                const error = resolveLookupError(config.input, 'input_not_found', config.health);
                return {
                    success: false,
                    action: 'submit_ready',
                    mode: config.submitMode,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            const buttonResult = buttonConfigured
                ? await waitForElement(config.button, 'button', diagnostics.button, 10000, false)
                : { element: null };
            const buttonElement = buttonResult.element;

            if (buttonConfigured && !buttonElement) {
                const error = resolveLookupError(config.button, 'button_not_found', config.health);
                return {
                    success: false,
                    action: 'submit_ready',
                    mode: config.submitMode,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            const root = getComposerRoot(inputElement, buttonElement);
            const observer = createActivityObserver(root);
            const waitStartedAt = now();

            try {
                while (now() - waitStartedAt < ${timeoutMs}) {
                    const targetDiagnostics = buttonConfigured ? diagnostics.button : diagnostics.input;
                    const targetLookup = buttonConfigured ? config.button : config.input;
                    const targetKind = buttonConfigured ? 'button' : 'input';
                    const targetResult = findElement(targetLookup, targetKind, targetDiagnostics);
                    const targetElement = targetResult.element;
                    const isInteractive = Boolean(targetElement && isReadyForInteraction(targetElement));
                    const settledForMs = now() - observer.getLastMutationAt();
                    const waitedMs = now() - waitStartedAt;

                    if (isInteractive && waitedMs >= ${minimumWaitMs} && settledForMs >= ${settleMs}) {
                        diagnostics.submitMs = roundMs(waitedMs);
                        return {
                            success: true,
                            action: 'submit_ready',
                            mode: config.submitMode,
                            diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                        };
                    }

                    await wait(250);
                }
            } finally {
                observer.disconnect();
            }

            const targetDiagnostics = buttonConfigured ? diagnostics.button : diagnostics.input;
            const targetLookup = buttonConfigured ? config.button : config.input;
            const targetKind = buttonConfigured ? 'button' : 'input';
            const targetResult = findElement(targetLookup, targetKind, targetDiagnostics);
            const error = targetResult.element
                ? 'submit_not_ready'
                : resolveLookupError(targetLookup, buttonConfigured ? 'button_not_found' : 'input_not_found', config.health);

            diagnostics.submitMs = roundMs(now() - waitStartedAt);
            return {
                success: false,
                action: 'submit_ready',
                mode: config.submitMode,
                error,
                diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
            };
        } catch (error) {
            return {
                success: false,
                action: 'submit_ready',
                error: error instanceof Error ? error.message : 'submit_not_ready',
                diagnostics: finalizeDiagnostics(
                    diagnostics,
                    scriptStartedAt,
                    error instanceof Error ? error.message : 'submit_not_ready'
                )
            };
        }
    })();
    `
}

export { generateWaitForSubmitReadyScript }
