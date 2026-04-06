/**
 * Electron `<webview allowpopups>` is serialized as the string "true" in the DOM.
 * `@types/react` types `allowpopups` as boolean only; passing a boolean triggers a React dev warning
 * for this custom attribute. Runtime value stays the string `"true"`.
 */
export const WEBVIEW_ALLOW_POPUPS = 'true'
