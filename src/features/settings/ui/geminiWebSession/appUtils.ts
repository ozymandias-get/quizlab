import {
  GOOGLE_WEB_SESSION_APPS,
  type GoogleWebSessionAppId
} from '@shared-core/constants/google-ai-web-apps'

export const MANAGED_APP_IDS = new Set(GOOGLE_WEB_SESSION_APPS.map((app) => app.id))

export const getNextEnabledManagedAppIds = (
  appId: GoogleWebSessionAppId,
  enabledAppIds: Set<GoogleWebSessionAppId>
) => {
  return enabledAppIds.has(appId)
    ? GOOGLE_WEB_SESSION_APPS.filter((app) => app.id !== appId && enabledAppIds.has(app.id)).map(
        (app) => app.id
      )
    : GOOGLE_WEB_SESSION_APPS.filter((app) => enabledAppIds.has(app.id) || app.id === appId).map(
        (app) => app.id
      )
}
