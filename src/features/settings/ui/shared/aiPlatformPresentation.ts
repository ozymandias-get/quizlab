import type { ReactNode } from 'react'
import { getAiIcon } from '@ui/components/Icons'
import type { AiPlatform } from '@shared-core/types'

type AiPlatformPresentation = Pick<AiPlatform, 'displayName' | 'icon' | 'name'>

export function getAiPlatformIcon(
  platform: Pick<AiPlatformPresentation, 'icon'> | undefined,
  fallbackKey: string,
  fallbackIcon: ReactNode
) {
  return getAiIcon(platform?.icon || fallbackKey) || fallbackIcon
}

export function getAiPlatformLabel(
  platform: Pick<AiPlatformPresentation, 'displayName' | 'name'> | undefined,
  fallbackKey: string,
  t?: (key: string) => string
) {
  const translated = t?.(fallbackKey)
  if (translated && translated !== fallbackKey) {
    return translated
  }

  return (
    platform?.displayName ||
    platform?.name ||
    fallbackKey.charAt(0).toUpperCase() + fallbackKey.slice(1)
  )
}
