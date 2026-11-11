import {
  GOOGLE_WEB_SESSION_REGISTRY_IDS,
  type GoogleWebSessionAppId
} from '@shared-core/constants/googleAiWebApps'
import type { AiPlatform } from '@shared-core/types'

const MANAGED_GOOGLE_PLATFORM_IDS: readonly GoogleWebSessionAppId[] = [
  ...GOOGLE_WEB_SESSION_REGISTRY_IDS
]

function isManagedGooglePlatform(platformId: string) {
  return MANAGED_GOOGLE_PLATFORM_IDS.includes(platformId as GoogleWebSessionAppId)
}

export function isCustomSitePlatform(platform: AiPlatform) {
  return Boolean(platform.isSite) && !isManagedGooglePlatform(platform.id)
}
