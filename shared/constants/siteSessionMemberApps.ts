/**
 * The names of the apps a site row covers.
 *
 * A site is one partition and one cookie set, and the Google group is the one
 * case where several apps share a single site, so its row names them. The main
 * process sends the app ids of a row, so the renderer needs a name for each
 * of them; the map lives here so the site-session UI does not depend on the
 * Google registry that the retired feature owned.
 *
 * These are the product names of the apps. They are proper nouns and are
 * deliberately not translated: a translation key per app would only spell the
 * same names differently in every language.
 */
const SITE_SESSION_MEMBER_APP_NAMES = {
  gemini: 'Gemini',
  aistudio: 'AI Studio',
  youtube: 'YouTube',
  gdrive: 'Google Drive'
} as const satisfies Record<string, string>

/**
 * The name of an app a site row covers.
 *
 * An unknown id keeps its raw form: a member the map does not know about is
 * still better than a member that silently disappears from the row.
 */
export function getSiteSessionMemberAppName(memberAppId: string): string {
  if (!Object.hasOwn(SITE_SESSION_MEMBER_APP_NAMES, memberAppId)) {
    return memberAppId
  }
  const name = (SITE_SESSION_MEMBER_APP_NAMES as Record<string, string | undefined>)[memberAppId]
  return name ?? memberAppId
}
