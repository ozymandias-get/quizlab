/// <reference types="vite/client" />
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import type { IconProps } from './iconProps'

const iconModules = import.meta.glob<{ default: ComponentType<IconProps> }>('./ai/*.tsx')

const AI_ICON_KEYS = new Set([
  'chatgpt',
  'qwen',
  'grok',
  'kimi',
  'perplexity',
  'deepseek',
  'mistral',
  'copilot',
  'manus',
  'claude',
  'gemini',
  'notebooklm',
  'aistudio',
  'youtube',
  'gdrive',
  'huggingchat',
  'globe'
])

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
  return (
    <Suspense fallback={null}>
      <LazyComp {...iconProps} />
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
