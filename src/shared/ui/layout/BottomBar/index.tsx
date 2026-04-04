import { useEffect, useCallback, memo, type MouseEvent as ReactMouseEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppearance, useLanguageStrings } from '@app/providers'
import { useAiTabsList } from '@app/providers/AiContext'
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
    useAppearance(
      useShallow((s) => ({
        bottomBarOpacity: s.bottomBarOpacity,
        bottomBarScale: s.bottomBarScale,
        showOnlyIcons: s.showOnlyIcons,
        toggleLayoutSwap: s.toggleLayoutSwap,
        isTourActive: s.isTourActive
      }))
    )
  const { tabs } = useAiTabsList()
  const { t, language } = useLanguageStrings()
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
    (e: ReactMouseEvent) => {
      if (!isOpen) {
        onMouseDown?.(e)
      }
    },
    [isOpen, onMouseDown]
  )

  const handleResizerMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      onMouseDown?.(e)
    },
    [onMouseDown]
  )

  return (
    <>
      <div
        ref={barRef}
        data-app-locale={language}
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
