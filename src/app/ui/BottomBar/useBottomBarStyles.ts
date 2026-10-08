import { type CSSProperties, useMemo } from 'react'

const BASE_SIZE = 48

export const useBottomBarStyles = (bottomBarOpacity: number, bottomBarScale: number) => {
  const clampedOpacity = Math.min(1, Math.max(0.1, bottomBarOpacity))
  const clampedScale = Math.min(1.3, Math.max(0.7, bottomBarScale))

  const shellStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--bar-opacity-factor': clampedOpacity,
        '--bar-scale-factor': clampedScale,
        width: BASE_SIZE,
        minWidth: BASE_SIZE,
        maxWidth: BASE_SIZE,
        flexBasis: BASE_SIZE,
        background: 'transparent'
      }) as CSSProperties,
    [clampedOpacity, clampedScale]
  )

  const stackStyle = useMemo<CSSProperties>(
    () => ({
      zIndex: 50,
      width: BASE_SIZE,
      minWidth: BASE_SIZE,
      maxWidth: BASE_SIZE,
      transform: `scale(${clampedScale})`,
      transformOrigin: 'center center',
      willChange: 'transform'
    }),
    [clampedScale]
  )

  return { shellStyle, stackStyle }
}
