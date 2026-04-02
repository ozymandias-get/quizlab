import { useMemo, useState } from 'react'
import { useAppTools, useAppearance, useUpdate } from '@app/providers'
import { usePanelResize, useWebviewMount } from '@shared/hooks'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useAppAnimations } from './useAppAnimations'
import { useOnlineStatus } from './useOnlineStatus'

export function useAppShellState() {
  useOnlineStatus()

  const appTools = useAppTools()
  const update = useUpdate()
  const appearance = useAppearance()
  const [isBarHovered, setIsBarHovered] = useState(false)
  const [isUpdateBannerVisible, setIsUpdateBannerVisible] = useState(true)

  const resizerShellWidth = useMemo(() => {
    const clampedBarScale = Math.min(1.3, Math.max(0.7, appearance.bottomBarScale))
    return Math.round(48 * clampedBarScale)
  }, [appearance.bottomBarScale])

  const panelResize = usePanelResize({
    initialWidth: 50,
    minLeft: 300,
    minRight: 400,
    storageKey: STORAGE_KEYS.LEFT_PANEL_WIDTH,
    isReversed: appearance.isLayoutSwapped,
    resizerWidth: resizerShellWidth
  })

  const animations = useAppAnimations(appearance.isLayoutSwapped)
  const isWebviewMounted = useWebviewMount()

  return {
    appTools,
    update,
    appearance,
    animations,
    isWebviewMounted,
    panelResize,
    workspaceState: {
      isBarHovered,
      setIsBarHovered
    },
    updateBanner: {
      isVisible: isUpdateBannerVisible,
      close: () => setIsUpdateBannerVisible(false)
    },
    tour: {
      isActive: appearance.isTourActive,
      close: () => appearance.setIsTourActive(false)
    }
  }
}
