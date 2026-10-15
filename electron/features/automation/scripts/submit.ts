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
                    success = true;
                    __finalizeSelectorRepair(diagnostics.input, 'input', true);
                } else {
                    error = resolveLookupError(config.input, 'input_not_found', config.health);
                    __finalizeSelectorRepair(diagnostics.input, 'input', false);
                }
`
    : `
                inputElement.focus();
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
                success = true;
                __finalizeSelectorRepair(diagnostics.input, 'input', true);
`

  return `
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
                    success = true;
                    // A completed click is the send button's only "real usage".
                    __finalizeSelectorRepair(diagnostics.button, 'button', true);
                } else if (mode === 'click') {
                    error = resolveLookupError(config.button, 'button_not_found', config.health);
                    __finalizeSelectorRepair(diagnostics.button, 'button', false);
                }
            }

            if (!success && (mode === 'enter_key' || mode === 'mixed')) {
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
