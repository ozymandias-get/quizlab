import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { Brain } from 'lucide-react'
import { useLanguage, useAppTools } from '@app/providers'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { GeminiIcon, LoaderIcon, MagicWandIcon, SettingsIcon, SwapIcon } from '@ui/components/Icons'
import { toolListVariants } from './animations'
import { ToolButton } from './ToolButton'
import { BottomBarPanelFrame } from './BottomBarPanelFrame'

interface ToolsPanelProps {
  isOpen: boolean
  panelStyle: React.CSSProperties
  maxHeight?: number
  handleSettingsClick: () => void
  handleGeminiWebSettingsClick: () => void
  toggleLayoutSwap: () => void
  isQuizMode: boolean
  onToggleQuizMode: () => void
}

export const ToolsPanel = memo(
  ({
    isOpen,
    panelStyle,
    maxHeight,
    handleSettingsClick,
    handleGeminiWebSettingsClick,
    toggleLayoutSwap,
    isQuizMode,
    onToggleQuizMode
  }: ToolsPanelProps) => {
    const { t } = useLanguage()
    const { isPickerActive, togglePicker, isGeminiWebLoginInProgress, startGeminiWebLogin } =
      useAppTools()
    const { data: webSessionData, isLoading: isGeminiWebStatusLoading } = useGeminiWebStatus()

    const toolbarIconStyle: React.CSSProperties = {
      width: 'calc(1.25rem * var(--bar-scale-factor, 1))',
      height: 'calc(1.25rem * var(--bar-scale-factor, 1))'
    }

    const isGeminiWebEnabled = !!webSessionData?.featureEnabled && !!webSessionData?.enabled
    const geminiWebState = webSessionData?.state ?? 'uninitialized'
    const needsGeminiWebLogin =
      geminiWebState === 'auth_required' || geminiWebState === 'reauth_required'
    const isGeminiWebDegraded = geminiWebState === 'degraded' || geminiWebState === 'uninitialized'
    const geminiWebActiveColor = needsGeminiWebLogin
      ? 'rgba(239,68,68,0.45)'
      : isGeminiWebDegraded || isGeminiWebStatusLoading
        ? 'rgba(245,158,11,0.42)'
        : 'rgba(16,185,129,0.4)'
    const geminiWebTitle = isGeminiWebLoginInProgress
      ? t('gws_toolbar_checking')
      : needsGeminiWebLogin
        ? geminiWebState === 'reauth_required'
          ? t('gws_toolbar_reauth_required')
          : t('gws_toolbar_auth_required')
        : isGeminiWebDegraded || isGeminiWebStatusLoading
          ? t('gws_toolbar_degraded')
          : t('gws_toolbar_authenticated')

    const handleGeminiWebClick = () => {
      if (needsGeminiWebLogin) {
        void startGeminiWebLogin()
        return
      }

      handleGeminiWebSettingsClick()
    }

    return (
      <BottomBarPanelFrame
        isOpen={isOpen}
        panelStyle={panelStyle}
        maxHeight={maxHeight}
        className="bottom-bar-panel bottom-bar-panel--tools absolute bottom-full mb-1.5 left-0 w-full overflow-hidden"
        id={APP_CONSTANTS.TOUR_TARGETS.TOOLS_PANEL}
        scrollAreaTestId="tools-panel-scroll-area"
        scrollCueTestId="tools-panel-scroll-cue"
      >
        <motion.div
          className="flex flex-col items-center gap-2 py-3 w-full"
          variants={toolListVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <ToolButton
            id={APP_CONSTANTS.TOUR_TARGETS.TOOL_SETTINGS}
            delay={0.03}
            onClick={handleSettingsClick}
            title={t('settings')}
          >
            <SettingsIcon className="w-5 h-5" style={toolbarIconStyle} />
          </ToolButton>

          {isGeminiWebEnabled && (
            <ToolButton
              delay={0.02}
              isActive
              activeColor={geminiWebActiveColor}
              onClick={handleGeminiWebClick}
              title={`${t('gws_toolbar_title')} - ${geminiWebTitle}`}
            >
              {isGeminiWebLoginInProgress ? (
                <LoaderIcon className="w-5 h-5" />
              ) : (
                <GeminiIcon className="w-5 h-5" style={toolbarIconStyle} />
              )}
            </ToolButton>
          )}

          <ToolButton
            id={APP_CONSTANTS.TOUR_TARGETS.TOOL_SWAP}
            delay={0.05}
            onClick={toggleLayoutSwap}
            title={t('swap_window')}
          >
            <SwapIcon className="w-5 h-5" style={toolbarIconStyle} />
          </ToolButton>

          <ToolButton
            id={APP_CONSTANTS.TOUR_TARGETS.TOOL_PICKER}
            delay={0.06}
            isActive={isPickerActive}
            activeColor="rgba(139,92,246,0.35)"
            onClick={togglePicker}
            title={t('element_picker')}
          >
            <MagicWandIcon className="w-5 h-5" style={toolbarIconStyle} />
          </ToolButton>

          <ToolButton
            delay={0.12}
            isActive={isQuizMode}
            activeColor="rgba(168,85,247,0.5)"
            onClick={onToggleQuizMode}
            title={isQuizMode ? t('close_quiz') : t('open_quiz')}
          >
            <Brain className="w-5 h-5" style={toolbarIconStyle} />
          </ToolButton>
        </motion.div>
      </BottomBarPanelFrame>
    )
  }
)

ToolsPanel.displayName = 'ToolsPanel'
