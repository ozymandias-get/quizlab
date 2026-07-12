import type { GeminiWebSessionState } from '@shared-core/types'

import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'

import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { useAppearance, useAppToolActions, useAppToolPickerState } from '@app/providers'
import { useAiModelsCatalog, useAiTabActions } from '@app/providers/AiContext'
import {
  ExpandIcon,
  GeminiIcon,
  LoaderIcon,
  MagicWandIcon,
  SettingsIcon,
  SparklesExpandIcon,
  SwapIcon
} from '@ui/components/Icons'
import { getAiIcon } from '@ui/components/Icons'

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
    <FloatingDockIcon title={t('settings')} onClick={handleClick}>
      <SettingsIcon className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

export const SwapToolButton = memo(function SwapToolButton() {
  const { t } = useTranslation()
  const toggleLayoutSwap = useAppearance((s) => s.toggleLayoutSwap)

  return (
    <FloatingDockIcon title={t('swap_window')} onClick={toggleLayoutSwap}>
      <SwapIcon className="h-5 w-5" />
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
      title={isPdfFocusable ? t('pdf_focus') : t('pdf_focus_no_doc')}
      onClick={handleClick}
    >
      <ExpandIcon className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

export const AiFocusToolButton = memo(function AiFocusToolButton() {
  const { t } = useTranslation()
  const toggleFocusMode = useAppearance((s) => s.toggleFocusMode)
  const handleClick = useCallback(() => toggleFocusMode('ai'), [toggleFocusMode])

  return (
    <FloatingDockIcon title={t('ai_focus')} onClick={handleClick}>
      <SparklesExpandIcon className="h-5 w-5" />
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
      <MagicWandIcon className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

export const GeminiToolButton = memo(function GeminiToolButton({
  onOpenSettings
}: {
  onOpenSettings: (tab?: string) => void
}) {
  const { t } = useTranslation()
  const { data: webSessionData, isLoading: isGeminiWebStatusLoading } = useGeminiWebStatus()

  const handleClick = useCallback(() => {
    onOpenSettings('gemini-web')
  }, [onOpenSettings])

  const isGeminiWebEnabled = !!webSessionData?.featureEnabled && !!webSessionData?.enabled
  const geminiWebState: GeminiWebSessionState = webSessionData?.state ?? 'uninitialized'
  const isGeminiAuthRequired =
    geminiWebState === 'auth_required' || geminiWebState === 'reauth_required'

  if (!isGeminiWebEnabled) return null

  return (
    <FloatingDockIcon
      title={isGeminiAuthRequired ? t('gws_toolbar_auth_required') : t('gws_toolbar_title')}
      onClick={handleClick}
    >
      {isGeminiWebStatusLoading ? (
        <LoaderIcon className="h-5 w-5" />
      ) : (
        <GeminiIcon className="h-5 w-5" />
      )}
    </FloatingDockIcon>
  )
})

export const ModelIconsList = memo(function ModelIconsList({
  visibleModels
}: {
  visibleModels: Record<string, boolean>
}) {
  const { enabledModels, aiSites } = useAiModelsCatalog()
  const displayModels = useMemo(
    () => enabledModels.filter((id) => visibleModels[id] !== false),
    [enabledModels, visibleModels]
  )

  return displayModels.map((modelKey) => (
    <ModelDockIcon key={modelKey} modelKey={modelKey} site={aiSites[modelKey]} />
  ))
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
      {getAiIcon(modelKey) || (
        <span className="text-ql-10 flex h-5 w-5 items-center justify-center font-bold">
          {(site.displayName || modelKey).charAt(0)}
        </span>
      )}
    </FloatingDockIcon>
  )
})
