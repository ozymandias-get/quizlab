import { useTutorialStore } from '@features/tutorial/store/tutorialStore'

import { useAppearance, useUpdate } from '@app/providers'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { usePanelResize, useWebviewMount } from '@shared/hooks'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useAppAnimations } from './useAppAnimations'
import { useOnlineStatus } from './useOnlineStatus'

export function useAppShellState() {
  useOnlineStatus()

  const { updateAvailable, updateInfo } = useUpdate()
  const { bottomBarScale, isLayoutSwapped, focusMode, setFocusMode, toggleFocusMode } =
    useAppearance(
      useShallow((s) => ({
        bottomBarScale: s.bottomBarScale,
        isLayoutSwapped: s.isLayoutSwapped,
        focusMode: s.focusMode,
        setFocusMode: s.setFocusMode,
        toggleFocusMode: s.toggleFocusMode
      }))
    )
  const { activeTutorialId, closeTutorial } = useTutorialStore(
    useShallow((s) => ({
      activeTutorialId: s.activeTutorialId,
      closeTutorial: s.closeTutorial
    }))
  )
  const [isBarHovered, setIsBarHovered] = useState(false)
  const [isUpdateBannerVisible, setIsUpdateBannerVisible] = useState(true)

  const resizerShellWidth = useMemo(() => {
    const clampedBarScale = Math.min(1.3, Math.max(0.7, bottomBarScale))
    return Math.round(48 * clampedBarScale)
  }, [bottomBarScale])

  const panelResize = usePanelResize({
    initialWidth: 50,
    minLeft: 300,
    minRight: 400,
    storageKey: STORAGE_KEYS.LEFT_PANEL_WIDTH,
    isReversed: isLayoutSwapped,
    resizerWidth: resizerShellWidth
  })

  const animations = useAppAnimations(isLayoutSwapped)
  const isWebviewMounted = useWebviewMount()

  const closeUpdateBanner = useCallback(() => setIsUpdateBannerVisible(false), [])
  const closeFocusMode = useCallback(() => setFocusMode(null), [setFocusMode])

  const workspaceState = useMemo(
    () => ({
      isBarHovered,
      setIsBarHovered
    }),
    [isBarHovered]
  )

  const updateBanner = useMemo(
    () => ({
      isVisible: isUpdateBannerVisible,
      close: closeUpdateBanner
    }),
    [isUpdateBannerVisible, closeUpdateBanner]
  )

  const tour = useMemo(
    () => ({
      isActive: !!activeTutorialId,
      close: closeTutorial
    }),
    [activeTutorialId, closeTutorial]
  )

  const focus = useMemo(
    () => ({
      mode: focusMode,
      toggle: toggleFocusMode,
      close: closeFocusMode
    }),
    [focusMode, toggleFocusMode, closeFocusMode]
  )

  return useMemo(
    () => ({
      updateAvailable,
      updateInfo,
      isLayoutSwapped,
      animations,
      isWebviewMounted,
      panelResize,
      workspaceState,
      updateBanner,
      tour,
      focus
    }),
    [
      updateAvailable,
      updateInfo,
      isLayoutSwapped,
      animations,
      isWebviewMounted,
      panelResize,
      workspaceState,
      updateBanner,
      tour,
      focus
    ]
  )
}
