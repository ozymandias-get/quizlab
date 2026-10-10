/** Opening: console, translations, state, injected DOM helpers, ui template fns. */
export function buildPickerScriptHead(
  translationsJSON: string,
  injectedDomHelpers: string,
  getStepHtmlSource: string,
  getHintHtmlSource: string,
  pickerSessionId?: string | null
): string {
  // The session id binds emitted results to the picker session that produced
  // them, so a delayed timer from a previous session can never be accepted as
  // the new session's result (stale bridge result). JSON-serialized, so it is
  // always a safe JS string literal; null keeps the legacy emit format.
  const sessionLiteral =
    typeof pickerSessionId === 'string' && pickerSessionId
      ? JSON.stringify(pickerSessionId)
      : 'null'
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

        const TRANSLATIONS = ${translationsJSON};

        // Session binding for result emits (see buildPickerScriptHead docs).
        const __aiPickerSessionId = ${sessionLiteral};
        
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
