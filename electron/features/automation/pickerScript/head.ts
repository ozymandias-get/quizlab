/** Opening: console, translations, state, injected DOM helpers, ui template fns. */
export function buildPickerScriptHead(
  translationsJSON: string,
  injectedDomHelpers: string,
  getStepHtmlSource: string,
  getHintHtmlSource: string
): string {
  return `        const safeConsole = {
            info: (window.console && window.console.info) ? window.console.info.bind(window.console) : function(){},
            error: (window.console && window.console.error) ? window.console.error.bind(window.console) : function(){}
        };
        const safePickerLog = (scope, error) => {
            try {
                safeConsole.info('[AI Picker suppressed] ' + scope, error);
            } catch (_logError) {
                void _logError;
            }
        };
        const ignoreDomAccessError = (_error) => {};

        const TRANSLATIONS = ${translationsJSON};
        
        if (window._aiPickerCleanup) window._aiPickerCleanup();

        let step = 'input';
        const selectionData = {
            version: 2,
            input: null,
            button: null,
            waitFor: null,
            submitMode: 'mixed',
            inputCandidates: [],
            buttonCandidates: [],
            inputFingerprint: null,
            buttonFingerprint: null
        };
        let selectedInputElement = null;
        let typingAdvanceTimer = null;

${injectedDomHelpers}
        const getStepHtml = ${getStepHtmlSource};
        const getHintHtml = ${getHintHtmlSource};
`
}
