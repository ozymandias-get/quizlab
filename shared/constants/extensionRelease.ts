/**
 * Where the user gets the Chrome site-session extension.
 *
 * The extension is no longer shipped inside the app: it is a separate download
 * that the user loads into the browser themselves. The app only links to the
 * release page and shows the pairing code the extension needs.
 */
export const QUIZLAB_EXTENSION_RELEASE_URL =
  'https://github.com/ozymandias-get/quizlab/releases/latest'

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
