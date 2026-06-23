import type { GeminiWebSessionState } from '@shared-core/types'

import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'

import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { useAppearance, useAppToolActions, useAppToolPickerState } from '@app/providers'
import { useAiModelsCatalog, useAiTabActions } from '@app/providers/AiContext'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
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

import { motion, useMotionValue, useSpring } from 'motion/react'
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

const DOCK_ICON_BASE = 32
const DOCK_ICON_HOVER = 44

const ICON_CONTAINER_STYLE: CSSProperties = {
  width: 'calc(1.25rem * var(--bar-scale-factor, 1))',
  height: 'calc(1.25rem * var(--bar-scale-factor, 1))'
}

interface FloatingDockInnerProps {
  onOpenSettings: (tab: string) => void
}

export const FloatingDockInner = memo(function FloatingDockInner({
  onOpenSettings
}: FloatingDockInnerProps) {
  const mouseY = useMotionValue(Infinity)

  const { visibleTools: rawVisibleTools, visibleModels: rawVisibleModels } = useAppearance(
    useShallow((s) => ({
      visibleTools: s.visibleTools,
      visibleModels: s.visibleModels
    }))
  )
  const visibleTools = useMemo(() => rawVisibleTools ?? {}, [rawVisibleTools])
  const visibleModels = useMemo(() => rawVisibleModels ?? {}, [rawVisibleModels])

  const handleMouseMove = useCallback((e: React.MouseEvent) => mouseY.set(e.clientY), [mouseY])
  const handleMouseLeaveReset = useCallback(() => mouseY.set(Infinity), [mouseY])

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeaveReset}
      className="flex w-full flex-col items-center gap-1.5 py-2"
    >
      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_SETTINGS] !== false && (
        <SettingsToolButton onOpenSettings={onOpenSettings} />
      )}

      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_SWAP] !== false && <SwapToolButton />}

      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_PDF_FOCUS] !== false && <PdfFocusToolButton />}

      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_AI_FOCUS] !== false && <AiFocusToolButton />}

      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_PICKER] !== false && <PickerToolButton />}

      <GeminiToolButton onOpenSettings={onOpenSettings} />

      <div
        className="my-[calc(0.25rem*var(--bar-scale-factor,1))] h-px w-4 bg-white/10"
        role="separator"
      />

      <ModelIconsList visibleModels={visibleModels} />
    </motion.div>
  )
})

/* ── Tool buttons as isolated memo sub-components ── */

const SettingsToolButton = memo(function SettingsToolButton({
  onOpenSettings
}: {
  onOpenSettings: (tab: string) => void
}) {
  const { t } = useTranslation()
  const handleClick = useCallback(() => onOpenSettings('prompts'), [onOpenSettings])

  return (
    <FloatingDockIcon title={t('settings')} onClick={handleClick}>
      <SettingsIcon className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

const SwapToolButton = memo(function SwapToolButton() {
  const { t } = useTranslation()
  const toggleLayoutSwap = useAppearance((s) => s.toggleLayoutSwap)

  return (
    <FloatingDockIcon title={t('swap_window')} onClick={toggleLayoutSwap}>
      <SwapIcon className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

const PdfFocusToolButton = memo(function PdfFocusToolButton() {
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

const AiFocusToolButton = memo(function AiFocusToolButton() {
  const { t } = useTranslation()
  const toggleFocusMode = useAppearance((s) => s.toggleFocusMode)
  const handleClick = useCallback(() => toggleFocusMode('ai'), [toggleFocusMode])

  return (
    <FloatingDockIcon title={t('ai_focus')} onClick={handleClick}>
      <SparklesExpandIcon className="h-5 w-5" />
    </FloatingDockIcon>
  )
})

const PickerToolButton = memo(function PickerToolButton() {
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

/* ── Gemini ── */

const GeminiToolButton = memo(function GeminiToolButton({
  onOpenSettings
}: {
  onOpenSettings: (tab: string) => void
}) {
  const { t } = useTranslation()
  const { data: webSessionData, isLoading: isGeminiWebStatusLoading } = useGeminiWebStatus()
  const { openAiWorkspace } = useAiTabActions()
  const { enabledModels } = useAiModelsCatalog()
  const isGeminiModelEnabled = enabledModels.includes('gemini')

  const handleClick = useCallback(() => {
    if (isGeminiModelEnabled) {
      openAiWorkspace('gemini')
    } else {
      onOpenSettings('gemini-web')
    }
  }, [isGeminiModelEnabled, openAiWorkspace, onOpenSettings])

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

/* ── Model icons ── */

const ModelIconsList = memo(function ModelIconsList({
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

interface FloatingDockIconProps {
  title: string
  children: ReactNode
  id?: string
  onClick: () => void
}

const FloatingDockIcon = memo(function FloatingDockIcon({
  title,
  children,
  id,
  onClick
}: FloatingDockIconProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const isMountedRef = useRef(true)

  const handleMouseEnter = useCallback(() => {
    if (isMountedRef.current) setIsHovered(true)
  }, [])
  const handleMouseLeave = useCallback(() => {
    if (isMountedRef.current) setIsHovered(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    },
    [onClick]
  )

  const scale = useSpring(isHovered ? DOCK_ICON_HOVER / DOCK_ICON_BASE : 1, {
    mass: 0.1,
    stiffness: 150,
    damping: 20
  })

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return (
    <motion.div
      ref={ref}
      id={id}
      role="button"
      tabIndex={0}
      aria-label={title}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{ width: DOCK_ICON_BASE, height: DOCK_ICON_BASE, scale }}
      className="relative flex shrink-0 origin-center cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/10 transition-colors duration-150 hover:border-white/20 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
    >
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 8, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 4, x: '-50%' }}
          className="z-tooltip absolute -top-8 left-1/2 w-max rounded-md border border-white/10 bg-neutral-900 px-2 py-0.5 text-xs whitespace-nowrap text-white"
          role="tooltip"
        >
          {title}
        </motion.div>
      )}
      <div className="flex items-center justify-center text-white/70" style={ICON_CONTAINER_STYLE}>
        {children}
      </div>
    </motion.div>
  )
})
