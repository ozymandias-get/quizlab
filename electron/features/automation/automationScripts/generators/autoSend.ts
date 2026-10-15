import type { AutomationConfig, TextInputMode } from '@shared-core/types'

import { serializeAutomationConfig } from '../../scripts/config.js'
import { buildHumanTypingScript } from '../../scripts/humanTyping.js'
import { buildSetInputValueScript } from '../../scripts/setInputValue.js'
import { buildPerformSubmitScript } from '../../scripts/submit.js'
import { createScriptPreamble } from '../preamble.js'

const generateAutoSendScript = (
  config: AutomationConfig,
  text: string,
  shouldSubmit: boolean = true,
  appendMode: boolean = false,
  textInputMode: TextInputMode = 'auto',
  typingSpeed: number = 30
): string => {
  const serialized = serializeAutomationConfig(config)
  const safeText = JSON.stringify(text)
  const performSubmitScript = buildPerformSubmitScript({ includeInputLookupForEnter: false })

  if (textInputMode === 'typing') {
    return `
    ${createScriptPreamble('auto_send', serialized, true)}
        const APPEND_TEXT_MODE = false;

${buildHumanTypingScript()}

${performSubmitScript}

        try {
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, config, 10000, false);
            const inputElement = inputResult.element;
            if (!inputElement) {
                const error = resolveLookupError(config.input, 'input_not_found', config.health);
                return {
                    success: false,
                    error,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, error)
                };
            }

            await humanType(inputElement, ${safeText}, ${typingSpeed});
            // Text insertion really landed, so an input recovery is now an
            // observed success. Without this the self-healing loop would only
            // ever see "element found", which is exactly the false positive the
            // staged promotion policy exists to prevent.
            __finalizeSelectorRepair(diagnostics.input, 'input', true);
            if (!${shouldSubmit}) {
                return {
                    success: true,
                    action: 'input_only',
                    mode: config.submitMode,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                };
            }

            if (config.submitMode === 'enter_key') {
                // Enter yolunda buton etkileşim kapısı yoktur; editörün
                // yapıştırmayı işlemesi için kısa sabit settle korunur.
                diagnostics.preSubmitWaitMs = 500;
                await wait(500);
            } else {
                // click/mixed zaten performSubmit içinde "buton etkileşime
                // hazır" kapısından (waitForElement + isReadyForInteraction)
                // geçer; ikinci bir sabit 500ms bekleme yalnızca gecikme ekler.
                diagnostics.preSubmitWaitMs = 0;
            }
            const submitResult = await performSubmit(inputElement);
            __finalizeSelectorRepair(diagnostics.button, 'button', submitResult.success);
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
            __finalizeSelectorRepair(diagnostics.input, 'input', false);
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

  if (textInputMode === 'auto') {
    return `
    ${createScriptPreamble('auto_send', serialized, true)}
        const APPEND_TEXT_MODE = ${appendMode ? 'true' : 'false'};

${buildSetInputValueScript()}

${buildHumanTypingScript()}

${performSubmitScript}

        const validatePasteResult = async (element, expected) => {
            const isCE = element.isContentEditable || element.getAttribute('contenteditable') === 'true';
            const read = () => isCE ? (element.textContent || '') : String(element.value || '');
            const expectedNormalized = normalizeForCompare(expected);
            if (!expectedNormalized) return false;
            const sampleLength = Math.min(40, expectedNormalized.length);
            const headSample = expectedNormalized.substring(0, sampleLength);
            const tailSample = expectedNormalized.substring(expectedNormalized.length - sampleLength);
            const matches = () => {
                const actual = normalizeForCompare(read());
                if (!actual) return false;
                return actual.includes(headSample) || actual.includes(tailSample);
            };
            // Editörler (ProseMirror/Lexical) içeriği kendi blok modeline göre
            // okur: blok sınırındaki çift satır sonu tek satır sonuna
            // dönüşebilir, görünmez karakterler eklenebilir. Ham includes() bu
            // yüzden yanlış negatif üretip gereksiz karakter karakter yazımı
            // (dakikalar) tetikliyordu. Kısa retry yalnızca gerçekten
            // uygulanmadıysa bekler; uygulandıysa ilk okuma anında döner
            // (ek gecikme yok).
            for (let attempt = 0; attempt < 3; attempt++) {
                if (matches()) return true;
                await wait(40);
            }
            return matches();
        };

        try {
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, config, 10000, false);
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
            const pasteSucceeded = await validatePasteResult(inputElement, ${safeText});
            if (!pasteSucceeded) {
                // Doğrulanamayan yapıştırma güvenli tarafta kalınarak yazımla
                // tamamlanır; ama cap'li hızla: 100ms/karakter'lik bir ayar
                // uzun promptta dakikalar sürer ve aynı görünümün kuyruğunu
                // kilitler (bkz. humanTyping iptal notu).
                diagnostics.textInputFallback = 'human_typing';
                await humanType(inputElement, ${safeText}, ${Math.min(typingSpeed, 30)});
            }

            // Pasted or typed text is now verifiably inside the field: this is
            // the "real usage" signal the self-healing loop counts.
            __finalizeSelectorRepair(diagnostics.input, 'input', true);
            if (!${shouldSubmit}) {
                return {
                    success: true,
                    action: 'input_only',
                    mode: config.submitMode,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                };
            }

            if (config.submitMode === 'enter_key') {
                // Enter yolunda buton etkileşim kapısı yoktur; editörün
                // yapıştırmayı işlemesi için kısa sabit settle korunur.
                diagnostics.preSubmitWaitMs = 500;
                await wait(500);
            } else {
                // click/mixed zaten performSubmit içinde "buton etkileşime
                // hazır" kapısından (waitForElement + isReadyForInteraction)
                // geçer; ikinci bir sabit 500ms bekleme yalnızca gecikme ekler.
                diagnostics.preSubmitWaitMs = 0;
            }
            const submitResult = await performSubmit(inputElement);
            __finalizeSelectorRepair(diagnostics.button, 'button', submitResult.success);
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
            __finalizeSelectorRepair(diagnostics.input, 'input', false);
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

  return `
    ${createScriptPreamble('auto_send', serialized, true)}
        const APPEND_TEXT_MODE = ${appendMode ? 'true' : 'false'};

${buildSetInputValueScript()}

${performSubmitScript}

        try {
            const inputResult = await waitForElement(config.input, 'input', diagnostics.input, config, 10000, false);
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
            __finalizeSelectorRepair(diagnostics.input, 'input', true);
            if (!${shouldSubmit}) {
                return {
                    success: true,
                    action: 'input_only',
                    mode: config.submitMode,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                };
            }

            if (config.submitMode === 'enter_key') {
                // Enter yolunda buton etkileşim kapısı yoktur; editörün
                // yapıştırmayı işlemesi için kısa sabit settle korunur.
                diagnostics.preSubmitWaitMs = 500;
                await wait(500);
            } else {
                // click/mixed zaten performSubmit içinde "buton etkileşime
                // hazır" kapısından (waitForElement + isReadyForInteraction)
                // geçer; ikinci bir sabit 500ms bekleme yalnızca gecikme ekler.
                diagnostics.preSubmitWaitMs = 0;
            }
            const submitResult = await performSubmit(inputElement);
            __finalizeSelectorRepair(diagnostics.button, 'button', submitResult.success);
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
            __finalizeSelectorRepair(diagnostics.input, 'input', false);
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
