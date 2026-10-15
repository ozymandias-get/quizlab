interface BuildPerformSubmitScriptOptions {
  includeInputLookupForEnter: boolean
}

/**
 * Builds the shared submit routine used by the auto-send and click-send scripts.
 *
 * Besides submitting, this is the single place that decides whether a *button*
 * or *input* recovery counts as a real, successful usage. The rule is
 * deliberately branch-local: a `click` submit only credits the button, an
 * `enter_key` submit only credits the input, so an untouched locator can never
 * be promoted on the strength of the other one's success.
 */
export function buildPerformSubmitScript(options: BuildPerformSubmitScriptOptions): string {
  const inputLookup = options.includeInputLookupForEnter
    ? `
                const inputResult = await waitForElement(config.input, 'input', diagnostics.input, config, 10000, false);
                const inputElement = inputResult.element;

                if (inputElement) {
                    inputElement.focus();
                    const beforeEnterText = readComposerText(inputElement);
                    const eventParams = {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    };
                    inputElement.dispatchEvent(new KeyboardEvent('keydown', eventParams));
                    inputElement.dispatchEvent(new KeyboardEvent('keypress', eventParams));
                    inputElement.dispatchEvent(new KeyboardEvent('keyup', eventParams));
                    diagnostics.submitMethod = 'enter_key';
                    success = await confirmEnterEffect(inputElement, beforeEnterText);
                    if (!success) error = 'submit_unverified';
                    __finalizeSelectorRepair(diagnostics.input, 'input', success);
                } else {
                    error = resolveLookupError(config.input, 'input_not_found', config.health);
                    __finalizeSelectorRepair(diagnostics.input, 'input', false);
                }
`
    : `
                inputElement.focus();
                const beforeEnterText = readComposerText(inputElement);
                const eventParams = {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                };
                inputElement.dispatchEvent(new KeyboardEvent('keydown', eventParams));
                inputElement.dispatchEvent(new KeyboardEvent('keypress', eventParams));
                inputElement.dispatchEvent(new KeyboardEvent('keyup', eventParams));
                diagnostics.submitMethod = 'enter_key';
                success = await confirmEnterEffect(inputElement, beforeEnterText);
                if (!success) error = 'submit_unverified';
                __finalizeSelectorRepair(diagnostics.input, 'input', success);
`

  return `
        // Synthetic Enter can be ignored by web apps (event.isTrusted=false).
        // Never report success simply because dispatchEvent returned.
        const readComposerText = (element) => {
            if (!element) return '';
            const raw = ('value' in element)
                ? element.value
                : (typeof element.innerText === 'string' && element.innerText.trim()
                    ? element.innerText : element.textContent);
            return normalizeForCompare(raw);
        };

        const confirmEnterEffect = async (element, before) => {
            if (!before) return false;
            // Only observe; never dispatch Enter a second time (duplicate-send risk).
            for (let i = 0; i < 12; i++) {
                if (isAborted()) return false;
                await wait(100);
                if (readComposerText(element) !== before) {
                    diagnostics.submitConfirmed = true;
                    return true;
                }
            }
            diagnostics.submitConfirmed = false;
            return false;
        };

        const performSubmit = async (${options.includeInputLookupForEnter ? '' : 'inputElement'}) => {
            const start = now();
            const mode = config.submitMode;
            let success = false;
            let error = null;

            if (mode === 'click' || mode === 'mixed') {
                const buttonResult = await waitForElement(config.button, 'button', diagnostics.button, config, 15000, true);
                const button = buttonResult.element;

                if (button) {
                    button.click();
                    diagnostics.submitMethod = 'button_click';
                    // Click was dispatched; server delivery cannot be proven here.
                    diagnostics.submitConfirmed = null;
                    success = true;
                    // A completed click is the send button's only "real usage".
                    __finalizeSelectorRepair(diagnostics.button, 'button', true);
                } else {
                    // If the button exists but is disabled, the web editor may
                    // still consider the prompt empty. Enter cannot fix that,
                    // and an untrusted key event must not hide the real error.
                    const candidate = findElement(config.button, 'button', diagnostics.button, config).element;
                    if (candidate && !isReadyForInteraction(candidate)) {
                        error = 'submit_not_ready';
                        diagnostics.submitNotReadyReason = describeNotReady(candidate);
                        __finalizeSelectorRepair(diagnostics.button, 'button', false);
                    } else if (mode === 'click') {
                        error = resolveLookupError(config.button, 'button_not_found', config.health);
                        __finalizeSelectorRepair(diagnostics.button, 'button', false);
                    }
                }
            }

            if (!success && !error && (mode === 'enter_key' || mode === 'mixed')) {
${inputLookup}
            }

            diagnostics.submitMs = roundMs(now() - start);
            return {
                success,
                error
            };
        };
    `
}
