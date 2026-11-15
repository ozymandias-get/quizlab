/**
 * The identity of the Chrome site-session extension.
 *
 * The extension ships inside the app and is loaded once as an unpacked
 * extension from the folder the app prepares. The app only shows the folder
 * path and the pairing code the extension needs.
 *
 * There are two builds of the same source code. Which one a folder becomes is
 * decided by the manifest `key`: Chrome derives the extension id from it, so a
 * pinned key is a pinned identity that does not change with the load path.
 *
 *   - `prod` is the build the installed app prepares. Its id must never change:
 *     the bridge allowlist, every existing pairing and the Chrome storage of the
 *     user are tied to it.
 *   - `dev` is the build the source checkout prepares for `npm run dev`. It has
 *     its own public key, its own id, its own port range and its own user data
 *     directory, so both builds can be loaded in the same Chrome and run next to
 *     each other.
 *
 * The dev key below is a PUBLIC key. The private half was never written
 * anywhere: it is not needed to load an unpacked extension, it is only needed to
 * pack a signed `.crx`, which this app does not do. Keeping the public half pins
 * the id; there is no secret in this file.
 */

/** Which of the two builds of the extension is in play. */
export type QuizlabEnvironment = 'prod' | 'dev'

/**
 * The id Chrome derives from the public key pinned in the release manifest.
 *
 * The bridge accepts only this origin, so a different extension cannot talk to
 * the app even if it knows the pairing code. The constant is checked against
 * the manifest by the extension contract test.
 */
export const QUIZLAB_EXTENSION_ID = 'follalbajmbjmkejipfikekdiodbkggp'

/** The origin of the extension, as the browser reports it on every request. */
export const QUIZLAB_EXTENSION_ORIGIN = `chrome-extension://${QUIZLAB_EXTENSION_ID}`

/** The name Chrome shows for the release build. */
const RELEASE_EXTENSION_NAME = 'Quizlab Site Session Bridge'

/**
 * The public key of the development build.
 *
 * Only the public half is kept. The matching private key was discarded when the
 * key was created, so the id is stable but no one can pack a signed build of the
 * extension with it. Chrome derives the id from this value exactly the same way
 * it derives the release id.
 */
export const QUIZLAB_DEV_EXTENSION_PUBLIC_KEY =
  // eslint-disable-next-line no-secrets/no-secrets -- a manifest public key pins the extension id; it is not a secret
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoWb+4eu6RIsFv8IKW6VkJ2fKsto1YnARjkeDcM9L3zzVZVsVwCyfN4B94sUO1ZghoKOcGZYsJAJfpxR/ZdmCrA+xY6+qA8+U9DTeiYuRhDc3+A830tB7VTETdPAU/3vhe1bVbguC/S1O1aP4bRadXEu0oPmI6V3RaRNz9FhtOtxjoqLJqvrvmzei7F4H99zpvqmYan+s2xRPeVHasJ+5sVwPSKVdwtfsVbtDzab+qsQZM6KichbTEwGC3js6FlCoipvYJ54kQQUvywLQFUSeaKStWkyV7tWITQp4xqesC9moD5je14xquOvQry9JWOyxP+KoWD6/Vp5do4IgbveYiwIDAQAB'

/**
 * The id Chrome derives from the dev public key above.
 *
 * The extension contract test re-derives it from the key, so the constant and
 * the key cannot drift apart.
 */
export const QUIZLAB_DEV_EXTENSION_ID = 'coonffpgfklpknbbkpilpcjjfjndheic'

/** The dev origin the dev bridge accepts. */
export const QUIZLAB_DEV_EXTENSION_ORIGIN = `chrome-extension://${QUIZLAB_DEV_EXTENSION_ID}`

/** The name Chrome shows for the development build. */
export const QUIZLAB_DEV_EXTENSION_NAME = 'Quizlab Site Session Bridge (Dev)'

/** The description written into the generated dev manifest. */
export const QUIZLAB_DEV_EXTENSION_DESCRIPTION =
  'Development build: shares session cookies with the local Quizlab Reader development app only.'

/** The id of the build one environment uses. */
export function extensionIdForEnvironment(environment: QuizlabEnvironment): string {
  return environment === 'dev' ? QUIZLAB_DEV_EXTENSION_ID : QUIZLAB_EXTENSION_ID
}

/** The origin the bridge of one environment accepts. */
export function extensionOriginForEnvironment(environment: QuizlabEnvironment): string {
  return environment === 'dev' ? QUIZLAB_DEV_EXTENSION_ORIGIN : QUIZLAB_EXTENSION_ORIGIN
}

/** The display name of the build one environment uses. */
export function extensionNameForEnvironment(environment: QuizlabEnvironment): string {
  return environment === 'dev' ? QUIZLAB_DEV_EXTENSION_NAME : RELEASE_EXTENSION_NAME
}
