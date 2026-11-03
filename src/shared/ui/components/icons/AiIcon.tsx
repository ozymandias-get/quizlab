/// <reference types="vite/client" />
import { getAiServiceColor } from '@shared-core/constants/aiChatCatalog'

import { type ComponentType, lazy, type LazyExoticComponent, type ReactNode, Suspense } from 'react'

import type { IconProps } from './iconProps'

const iconModules = import.meta.glob<{ default: ComponentType<IconProps> }>('./ai/*.tsx')

const AI_ICON_KEYS = new Set(
  Object.keys(iconModules).map((path) => path.replace('./ai/', '').replace('.tsx', ''))
)

const lazyByKey = new Map<string, LazyExoticComponent<ComponentType<IconProps>>>()

function getLazyForKey(modelKey: string) {
  let cached = lazyByKey.get(modelKey)
  if (!cached) {
    const path = `./ai/${modelKey}.tsx`
    const loader = iconModules[path]
    if (!loader) return undefined
    cached = lazy(loader)
    lazyByKey.set(modelKey, cached)
  }
  return cached
}

export function AiIcon({ modelKey, ...iconProps }: { modelKey: string } & IconProps) {
  const LazyComp = getLazyForKey(modelKey)
  if (!LazyComp) return null
  // Monochrome brand SVGs use currentColor; tint them with the service accent so
  // every catalogue icon carries its brand colour instead of inheriting gray.
  const color = getAiServiceColor(modelKey)
  return (
    <Suspense fallback={null}>
      <span style={color ? { color, display: 'inline-flex' } : undefined}>
        <LazyComp {...iconProps} />
      </span>
    </Suspense>
  )
}

/**
 * AI Model Icon Helper — loads the matching brand SVG in a separate chunk on first use.
 */
export const getAiIcon = (modelKey: string): ReactNode => {
  if (!AI_ICON_KEYS.has(modelKey)) return null
  return <AiIcon modelKey={modelKey} />
}
