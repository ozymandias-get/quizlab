/**
 * The identity of the Chrome site-session extension.
 *
 * The extension ships inside the app and is loaded once as an unpacked
 * extension from the folder the app prepares. The app only shows the folder
 * path and the pairing code the extension needs.
 */

/**
 * The id Chrome derives from the public key pinned in the extension manifest.
 *
 * The bridge accepts only this origin, so a different extension cannot talk to
 * the app even if it knows the pairing code. The constant is checked against
 * the manifest by the extension contract test.
 */
export const QUIZLAB_EXTENSION_ID = 'follalbajmbjmkejipfikekdiodbkggp'

/** The origin of the extension, as the browser reports it on every request. */
export const QUIZLAB_EXTENSION_ORIGIN = `chrome-extension://${QUIZLAB_EXTENSION_ID}`
