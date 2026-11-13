import { useAppearance, useUpdate } from '@app/providers'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useAiSurfaceMount, usePanelResize } from '@shared/hooks'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useAppAnimations } from './useAppAnimations'
import { useOnlineStatus } from './useOnlineStatus'

export function useAppShellState() {
  useOnlineStatus()

  const { updateAvailable, updateInfo } = useUpdate()
  const { isLayoutSwapped, focusMode, setFocusMode, toggleFocusMode } = useAppearance(
    useShallow((s) => ({
      isLayoutSwapped: s.isLayoutSwapped,
      focusMode: s.focusMode,
      setFocusMode: s.setFocusMode,
      toggleFocusMode: s.toggleFocusMode
    }))
  )
  const [isUpdateBannerVisible, setIsUpdateBannerVisible] = useState(true)

  const panelResize = usePanelResize({
    initialWidth: 50,
    minLeft: 300,
    minRight: 400,
    storageKey: STORAGE_KEYS.LEFT_PANEL_WIDTH,
    isReversed: isLayoutSwapped
  })

  const animations = useAppAnimations(isLayoutSwapped)
  const isAiSurfaceMounted = useAiSurfaceMount()

  const closeUpdateBanner = useCallback(() => setIsUpdateBannerVisible(false), [])
  const closeFocusMode = useCallback(() => setFocusMode(null), [setFocusMode])

  const updateBanner = useMemo(
    () => ({
      isVisible: isUpdateBannerVisible,
      close: closeUpdateBanner
    }),
    [isUpdateBannerVisible, closeUpdateBanner]
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
      isAiSurfaceMounted,
      panelResize,
      updateBanner,
      focus
    }),
    [
      updateAvailable,
      updateInfo,
      isLayoutSwapped,
      animations,
      isAiSurfaceMounted,
      panelResize,
      updateBanner,
      focus
    ]
  )
}
