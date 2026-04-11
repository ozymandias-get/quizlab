import { useCallback, useMemo, useState } from 'react'
import { useAppearance, useUpdate } from '@app/providers'
import { usePanelResize, useWebviewMount } from '@shared/hooks'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useAppAnimations } from './useAppAnimations'
import { useOnlineStatus } from './useOnlineStatus'

export function useAppShellState() {
  useOnlineStatus()

  const update = useUpdate()
  const bottomBarScale = useAppearance((s) => s.bottomBarScale)
  const isLayoutSwapped = useAppearance((s) => s.isLayoutSwapped)
  const isTourActive = useAppearance((s) => s.isTourActive)
  const setIsTourActive = useAppearance((s) => s.setIsTourActive)
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
  const closeTour = useCallback(() => setIsTourActive(false), [setIsTourActive])

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
      isActive: isTourActive,
      close: closeTour
    }),
    [isTourActive, closeTour]
  )

  return useMemo(
    () => ({
      update,
      isLayoutSwapped,
      animations,
      isWebviewMounted,
      panelResize,
      workspaceState,
      updateBanner,
      tour
    }),
    [
      update,
      isLayoutSwapped,
      animations,
      isWebviewMounted,
      panelResize,
      workspaceState,
      updateBanner,
      tour
    ]
  )
}
