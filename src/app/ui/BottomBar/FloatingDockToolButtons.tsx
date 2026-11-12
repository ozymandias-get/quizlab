import { isAiDockVisible } from '@shared-core/constants/aiChatCatalog'

import {
  hasEnabledSiteSession,
  hasSiteSessionNeedingAttention,
  useSiteSessionListQuery
} from '@platform/electron/api/useSiteSessionApi'

import { usePdfTabStore } from '@features/pdf'

import { useAppearance, useAppToolActions, useAppToolPickerState } from '@app/providers'
import { useAiModelsCatalog, useAiTabActions } from '@app/providers/ai-context'
import { getAiIcon } from '@ui/components/Icons'

import { ArrowLeftRight, Crosshair, Globe, Maximize2, Settings, Sparkles } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FloatingDockIcon } from './FloatingDockIcon'

export const SettingsToolButton = memo(function SettingsToolButton({
  onOpenSettings
}: {
  onOpenSettings: (tab?: string) => void
}) {
  const { t } = useTranslation()
  const handleClick = useCallback(() => onOpenSettings(), [onOpenSettings])

  return (
    <FloatingDockIcon id="tour-target-tool-settings" title={t('settings')} onClick={handleClick}>
      <Settings className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

export const SwapToolButton = memo(function SwapToolButton() {
  const { t } = useTranslation()
  const toggleLayoutSwap = useAppearance((s) => s.toggleLayoutSwap)
  const isLayoutSwapped = useAppearance((s) => s.isLayoutSwapped)

  return (
    <FloatingDockIcon
      title={t('swap_window')}
      onClick={toggleLayoutSwap}
      isActive={isLayoutSwapped}
    >
      <ArrowLeftRight
        className={`motion-normal h-5 w-5 transition-transform duration-300 ${
          isLayoutSwapped ? 'rotate-180' : 'rotate-0'
        }`}
      />
    </FloatingDockIcon>
  )
})

export const PdfFocusToolButton = memo(function PdfFocusToolButton() {
  const { t } = useTranslation()
  const toggleFocusMode = useAppearance((s) => s.toggleFocusMode)
  const pdfTabs = usePdfTabStore((s) => s.pdfTabs)
  const activePdfTabId = usePdfTabStore((s) => s.activePdfTabId)
  const activePdfTab = useMemo(() => {
    if (!activePdfTabId) return null
    return pdfTabs.find((tab) => tab.id === activePdfTabId) || null
  }, [pdfTabs, activePdfTabId])
  const isPdfFocusable = useMemo(
    () => !!activePdfTab && (!!activePdfTab.file || activePdfTab.kind === 'drive'),
    [activePdfTab]
  )
  const handleClick = useCallback(() => {
    if (isPdfFocusable) toggleFocusMode('pdf')
  }, [isPdfFocusable, toggleFocusMode])

  return (
    <FloatingDockIcon
      id="tour-target-tool-pdf-focus"
      title={isPdfFocusable ? t('pdf_focus') : t('pdf_focus_no_doc')}
      onClick={handleClick}
    >
      <Maximize2 className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

export const AiFocusToolButton = memo(function AiFocusToolButton() {
  const { t } = useTranslation()
  const toggleFocusMode = useAppearance((s) => s.toggleFocusMode)
  const handleClick = useCallback(() => toggleFocusMode('ai'), [toggleFocusMode])

  return (
    <FloatingDockIcon id="tour-target-tool-ai-focus" title={t('ai_focus')} onClick={handleClick}>
      <Sparkles className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

export const PickerToolButton = memo(function PickerToolButton() {
  const { t } = useTranslation()
  const { isPickerActive } = useAppToolPickerState()
  const { togglePicker, startPickerWhenReady } = useAppToolActions()
  const handleClick = useCallback(() => {
    if (isPickerActive) {
      void togglePicker()
      return
    }
    startPickerWhenReady()
  }, [isPickerActive, togglePicker, startPickerWhenReady])

  return (
    <FloatingDockIcon title={t('element_picker')} onClick={handleClick}>
      <Crosshair className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

export const GeminiToolButton = memo(function GeminiToolButton({
  onOpenSettings
}: {
  onOpenSettings: (tab?: string) => void
}) {
  const { t } = useTranslation()
  const { data: siteSessionData } = useSiteSessionListQuery()

  const handleClick = useCallback(() => {
    onOpenSettings('site-sessions')
  }, [onOpenSettings])

  const views = siteSessionData?.views ?? []
  // The button belongs to the feature, not to one site: it shows up as soon as
  // a single site pulls its session from Chrome.
  if (!hasEnabledSiteSession(views)) return null

  const needsAttention = hasSiteSessionNeedingAttention(views)

  return (
    <FloatingDockIcon
      title={needsAttention ? t('ws_toolbar_attention') : t('ws_toolbar_title')}
      onClick={handleClick}
    >
      <Globe className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

export const ModelIconsList = memo(function ModelIconsList({
  visibleModels
}: {
  visibleModels: Record<string, boolean>
}) {
  const { enabledModels, aiSites, favoriteModels = [] } = useAiModelsCatalog()
  const bottomBarMaxIcons = useAppearance((s) => s.bottomBarMaxIcons ?? 5)
  const displayModels = useMemo(() => {
    const isVisible = (id: string) =>
      aiSites[id] && isAiDockVisible(id, visibleModels, aiSites[id], favoriteModels)
    const favorites = favoriteModels.filter((id) => enabledModels.includes(id) && isVisible(id))
    const others = enabledModels.filter((id) => !favoriteModels.includes(id) && isVisible(id))
    // Favorites always remain reachable; the viewport stays at the user's icon limit.
    return [...favorites, ...others].slice(0, Math.max(bottomBarMaxIcons, favorites.length))
  }, [enabledModels, aiSites, favoriteModels, visibleModels, bottomBarMaxIcons])

  return (
    <div
      className="scrollbar-hidden flex w-full flex-col items-center gap-1 overflow-y-auto py-1"
      style={{ maxHeight: bottomBarMaxIcons * 36 + 8 }}
    >
      {displayModels.map((modelKey) => (
        <ModelDockIcon key={modelKey} modelKey={modelKey} site={aiSites[modelKey]} />
      ))}
    </div>
  )
})

const ModelDockIcon = memo(function ModelDockIcon({
  modelKey,
  site
}: {
  modelKey: string
  site?: { displayName?: string; name?: string; icon?: string; color?: string }
}) {
  const { openAiWorkspace } = useAiTabActions()
  const handleClick = useCallback(() => openAiWorkspace(modelKey), [modelKey, openAiWorkspace])

  if (!site) return null

  return (
    <FloatingDockIcon title={site.displayName || site.name || modelKey} onClick={handleClick}>
      {getAiIcon(site.icon || modelKey) || (
        <span className="text-ql-10 flex h-5 w-5 items-center justify-center font-bold">
          {(site.displayName || modelKey).charAt(0)}
        </span>
      )}
    </FloatingDockIcon>
  )
})
