import type { AiPlatform } from '@shared-core/types'

export const MANAGED_GOOGLE_PLATFORM_IDS = ['gemini', 'aistudio', 'youtube'] as const

export function isManagedGooglePlatform(platformId: string) {
  return MANAGED_GOOGLE_PLATFORM_IDS.includes(
    platformId as (typeof MANAGED_GOOGLE_PLATFORM_IDS)[number]
  )
}

export function isCustomModelPlatform(platform: AiPlatform) {
  return !platform.isSite && !isManagedGooglePlatform(platform.id)
}

export function isCustomSitePlatform(platform: AiPlatform) {
  return Boolean(platform.isSite) && !isManagedGooglePlatform(platform.id)
}
