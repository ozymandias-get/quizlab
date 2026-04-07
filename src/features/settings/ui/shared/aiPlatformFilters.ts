import type { AiPlatform } from '@shared-core/types'

export const MANAGED_GOOGLE_PLATFORM_IDS = ['gemini', 'notebooklm', 'aistudio', 'youtube'] as const

export const isManagedGooglePlatform = (platformId: string) =>
  MANAGED_GOOGLE_PLATFORM_IDS.includes(platformId as (typeof MANAGED_GOOGLE_PLATFORM_IDS)[number])

export const isCustomModelPlatform = (platform: AiPlatform) =>
  !platform.isSite && !isManagedGooglePlatform(platform.id)

export const isCustomSitePlatform = (platform: AiPlatform) =>
  Boolean(platform.isSite) && !isManagedGooglePlatform(platform.id)
