import type { AutomationConfig, TextInputMode } from '@shared-core/types'

import { serializeAutomationConfig } from '../../scripts/config.js'
import { buildHumanTypingScript } from '../../scripts/humanTyping.js'
import { buildSetInputValueScript } from '../../scripts/setInputValue.js'
import { buildPerformSubmitScript } from '../../scripts/submit.js'
import { buildTextVerificationScript } from '../../scripts/verifyTextPlacement.js'
import { createScriptPreamble } from '../preamble.js'

/**
 * Submit öncesi ortak blok. Enter yolunda buton etkileşim kapısı olmadığı için
 * kısa sabit settle korunur; click/mixed zaten `performSubmit` içindeki
 * "buton etkileşime hazır" kapısından geçer (ikinci 500ms yalnızca gecikme).
 */
const buildSubmitBlock = (shouldSubmit: boolean) => `
            if (!${shouldSubmit}) {
                return {
                    success: true,
                    action: 'input_only',
                    mode: config.submitMode,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt)
                };
            }

            if (config.submitMode === 'enter_key') {
                diagnostics.preSubmitWaitMs = 500;
                await wait(500);
            } else {
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
            };`

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
${buildSubmitBlock(shouldSubmit)}
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

${buildTextVerificationScript()}

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

            // Doğrulama başarıyı yalnızca GÖZLENEN değişiklikle ilişkilendirir:
            // yerleştirme öncesi içerik yakalanmadan "metin zaten alandaydı"
            // durumu kanıt sayılamaz (eski baş/son örnek kontrolü bu yüzden
            // yanlış pozitif üretiyordu).
            const beforeTextVariants = readFieldTextVariants(inputElement);
            await setInputValue(inputElement, ${safeText});
            let placement = await verifyTextPlacementWithRetries(inputElement, ${safeText}, beforeTextVariants);

            // Fallback yalnızca alan HİÇ değişmediyse: o durumda içerik
            // eklenmemiştir, yazım güvenli bir tamamlayıcıdır. Kısmi
            // yerleştirmede yeniden yazmak mükerrer içerik üretir; metin zaten
            // mevcutsa (ambiguous) yapıştırmanın etkisi kanıtlanamaz.
            if (!placement.applied && placement.state === 'unchanged') {
                // Doğrulanamayan yapıştırma güvenli tarafta kalınarak yazımla
                // tamamlanır; ama cap'li hızla: 100ms/karakter'lik bir ayar
                // uzun promptta dakikalar sürer ve aynı görünümün kuyruğunu
                // kilitler (bkz. humanTyping iptal notu). Append modunda
                // önceki içerik korunur.
                diagnostics.textInputFallback = 'human_typing';
                await humanType(inputElement, ${safeText}, ${Math.min(typingSpeed, 30)}, ${appendMode ? 'true' : 'false'});
                placement = await verifyTextPlacementWithRetries(inputElement, ${safeText}, beforeTextVariants);
            }

            diagnostics.textVerifyResult = placement.applied ? 'verified' : placement.state;
            diagnostics.textVerifyDelta = placement.delta;

            if (!placement.applied) {
                // İçerik uygulanmış gibi davranıp göndermek yerine aşamayı
                // açıkça bildir: submit edilmez, kullanıcı içeriği korunur.
                // Kısmi yerleştirme ayrı kod taşır (mükerrer risk; otomatik
                // retry yok). Selector onarımı "operation_failed" işaretlenir:
                // seçici bulundu ama metin gerçekten girmedi.
                const verifyError = placement.state === 'partial' ? 'text_input_partial' : 'text_input_unverified';
                __finalizeSelectorRepair(diagnostics.input, 'input', false);
                return {
                    success: false,
                    error: verifyError,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, verifyError)
                };
            }

            // Pasted or typed text is now verifiably inside the field: this is
            // the "real usage" signal the self-healing loop counts.
            __finalizeSelectorRepair(diagnostics.input, 'input', true);
${buildSubmitBlock(shouldSubmit)}
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

${buildTextVerificationScript()}

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

            // "paste" modu kullanıcının açık tercihi: yazım fallback'i yoktur.
            // Yine de doğrulamasız submit edilmez — metin gerçekten girmediyse
            // sessizce boş gönderim yapmak yerine hata döndürülür.
            const beforeTextVariants = readFieldTextVariants(inputElement);
            await setInputValue(inputElement, ${safeText});
            const placement = await verifyTextPlacementWithRetries(inputElement, ${safeText}, beforeTextVariants);

            diagnostics.textVerifyResult = placement.applied ? 'verified' : placement.state;
            diagnostics.textVerifyDelta = placement.delta;

            if (!placement.applied) {
                const verifyError = placement.state === 'partial' ? 'text_input_partial' : 'text_input_unverified';
                __finalizeSelectorRepair(diagnostics.input, 'input', false);
                return {
                    success: false,
                    error: verifyError,
                    diagnostics: finalizeDiagnostics(diagnostics, scriptStartedAt, verifyError)
                };
            }

            __finalizeSelectorRepair(diagnostics.input, 'input', true);
${buildSubmitBlock(shouldSubmit)}
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
