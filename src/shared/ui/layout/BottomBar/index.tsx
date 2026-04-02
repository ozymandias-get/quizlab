import React, { useEffect, useCallback, memo } from 'react'
import { useAppearance, useLanguage } from '@app/providers'
import { useAiState } from '@app/providers/AiContext'
import { CenterHub } from './CenterHub'
import { ToolsPanel } from './ToolsPanel'
import { ModelsPanel } from './ModelsPanel'
import SettingsModalPortal from './SettingsModalPortal'
import { useBottomBarStyles } from './useBottomBarStyles'
import { useBottomBarController } from './useBottomBarController'
import { useBottomBarPanelHeight } from './useBottomBarPanelHeight'
import type { BottomBarProps } from './types'

function BottomBar({ onHoverChange, onMouseDown }: BottomBarProps) {
  const { bottomBarOpacity, bottomBarScale, showOnlyIcons, toggleLayoutSwap, isTourActive } =
    useAppearance()
  const { tabs } = useAiState()
  const { t } = useLanguage()
  const {
    barRef,
    isOpen,
    isSettingsOpen,
    settingsInitialTab,
    handleToggle,
    handleHubPointerDown,
    handleHubPointerUp,
    openSettings,
    closeSettings,
    setIsOpen
  } = useBottomBarController(isTourActive)
  const panelHeight = useBottomBarPanelHeight(barRef, isOpen, bottomBarScale)
  const { shellStyle, stackStyle, panelStyle, hubStyle } = useBottomBarStyles(
    isOpen,
    bottomBarOpacity,
    bottomBarScale
  )

  useEffect(() => {
    if (!isOpen || isTourActive || isSettingsOpen) return
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, isTourActive, isSettingsOpen])

  const handleHubMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isOpen) {
        onMouseDown?.(e)
      }
    },
    [isOpen, onMouseDown]
  )

  const handleResizerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onMouseDown?.(e)
    },
    [onMouseDown]
  )

  return (
    <>
      <div
        ref={barRef}
        className={`resizer-hub-container bottom-bar-shell ${isOpen ? 'resizer-hub-container--open' : ''}`}
        style={shellStyle}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
      >
        <div className="resizer-drag-area" onMouseDown={handleResizerMouseDown} />

        <div
          className="bottom-bar-stack relative flex flex-col items-center w-full"
          style={stackStyle}
        >
          <ToolsPanel
            isOpen={isOpen}
            panelStyle={panelStyle}
            maxHeight={panelHeight}
            handleSettingsClick={() => openSettings('prompts')}
            handleGeminiWebSettingsClick={() => openSettings('gemini-web')}
            toggleLayoutSwap={toggleLayoutSwap}
          />

          <CenterHub
            handleHubPointerDown={handleHubPointerDown}
            handleHubPointerUp={handleHubPointerUp}
            onClick={() => handleToggle()}
            onMouseDown={handleHubMouseDown}
            isOpen={isOpen}
            hubStyle={hubStyle}
            tabsCount={tabs.length}
            ariaLabel={isOpen ? t('close') : t('ua_step1_text')}
          />

          <ModelsPanel
            isOpen={isOpen}
            panelStyle={panelStyle}
            maxHeight={panelHeight}
            showOnlyIcons={showOnlyIcons}
          />
        </div>

        <div className="resizer-drag-area" onMouseDown={handleResizerMouseDown} />
      </div>

      <SettingsModalPortal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        initialTab={settingsInitialTab}
      />
    </>
  )
}

export default memo(BottomBar)
