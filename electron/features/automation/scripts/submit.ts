interface BuildPerformSubmitScriptOptions {
  includeInputLookupForEnter: boolean
}

export function buildPerformSubmitScript(options: BuildPerformSubmitScriptOptions): string {
  const inputLookup = options.includeInputLookupForEnter
    ? `
                const inputResult = await waitForElement(config.input, 'input', diagnostics.input, 10000, false);
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
                } else {
                    error = resolveLookupError(config.input, 'input_not_found', config.health);
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
`

  return `
        const performSubmit = async (${options.includeInputLookupForEnter ? '' : 'inputElement'}) => {
            const start = now();
            const mode = config.submitMode;
            let success = false;
            let error = null;

            if (mode === 'click' || mode === 'mixed') {
                const buttonResult = await waitForElement(config.button, 'button', diagnostics.button, 15000, true);
                const button = buttonResult.element;

                if (button) {
                    button.click();
                    success = true;
                } else if (mode === 'click') {
                    error = resolveLookupError(config.button, 'button_not_found', config.health);
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
