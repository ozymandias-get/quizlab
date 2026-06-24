import type { AutomationConfig } from '@shared-core/types'

import { serializeAutomationConfig } from '../../scripts/config.js'
import { createScriptPreamble, normalizeMs } from '../preamble.js'

/**
 * Wait-for-submit-ready script
 * ─────────────────────────────────────────────────────────────────────────────
 * Önceki tasarım: 250ms sabit polling + MutationObserver (yalnızca "is settled" takibi)
 * Yeni tasarım:     event-driven wait (MutationObserver → microtask wake)
 *
 * Eski sürümde iki kritik sorun vardı:
 *   1. Polling aralığı (250ms) — yükleme sırasında tetiklenen buton 250ms
 *      gecikmeyle fark ediliyordu. Üstelik bazı siteler (örn. ChatGPT) buton
 *      görünür kıldıktan sonra yarım saniye içinde "stale" hâle getirip tekrar
 *      enable ediyor; polling bu salınımı kaçırıyordu.
 *   2. Progress bar / spinner mutation'ları settleMs eşiğini aşmayı imkânsız
 *      kılıyordu.
 *
 * Yeni sürüm (`__eventDrivenWait`):
 *   - Her mutasyon olduğunda uyanır, kontrol eder; eşik sağlandıysa döner.
 *   - 50ms'lik "idle wait" ile timeoutMs'i aşmadan uyur.
 *   - Tüm mutasyonlar observer tarafından yutulduğu için CPU kullanımı minimal.
 */
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
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, config, 10000, false);
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
                ? await waitForElement(config.button, 'button', diagnostics.button, config, 10000, false)
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
            const waitStartedAt = now();

            // Event-driven wait: polling yok, observer microtask uyandırması
            const result = await __eventDrivenWait({
                root: root,
                timeoutMs: ${timeoutMs},
                settleMs: ${settleMs},
                minimumWaitMs: ${minimumWaitMs},
                check: () => {
                    const targetLookup = buttonConfigured ? config.button : config.input;
                    const targetKind = buttonConfigured ? 'button' : 'input';
                    const targetResult = findElement(targetLookup, targetKind,
                        buttonConfigured ? diagnostics.button : diagnostics.input, config);
                    const targetElement = targetResult.element;
                    return (targetElement && isReadyForInteraction(targetElement))
                        ? { targetElement, targetResult }
                        : null;
                }
            });

            if (result.result) {
                diagnostics.submitMs = result.totalMs;
                return {
                    success: true,
                    action: 'submit_ready',
                    mode: config.submitMode,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                };
            }

            // Timeout — son durumu raporla
            const targetLookup = buttonConfigured ? config.button : config.input;
            const targetKind = buttonConfigured ? 'button' : 'input';
            const targetDiagnostics = buttonConfigured ? diagnostics.button : diagnostics.input;
            const targetResult = findElement(targetLookup, targetKind, targetDiagnostics, config);
            const error = targetResult.element
                ? 'submit_not_ready'
                : resolveLookupError(targetLookup, buttonConfigured ? 'button_not_found' : 'input_not_found', config.health);

            diagnostics.submitMs = result.totalMs;
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
