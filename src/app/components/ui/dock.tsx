import { cn } from '@shared/lib/uiUtils'

import { cva, type VariantProps } from 'class-variance-authority'
import type { MotionProps } from 'motion/react'
import { motion, type MotionValue, useMotionValue, useSpring, useTransform } from 'motion/react'
import React, {
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string
  iconSize?: number
  iconMagnification?: number
  disableMagnification?: boolean
  iconDistance?: number
  direction?: 'top' | 'middle' | 'bottom'
  /** Axis the magnification tracks. Vertical docks are used by the reader rail. */
  orientation?: 'horizontal' | 'vertical'
  children: React.ReactNode
}

const DEFAULT_SIZE = 40
const DEFAULT_MAGNIFICATION = 60
const DEFAULT_DISTANCE = 140
const DEFAULT_DISABLEMAGNIFICATION = false

const dockVariants = cva(
  'mx-auto mt-8 flex h-[58px] w-max items-center justify-center gap-2 rounded-2xl border border-white/12 bg-zinc-950/90 p-2 backdrop-blur-md'
)

interface DockPointerState {
  mouseX: MotionValue<number>
  orientation: 'horizontal' | 'vertical'
}

/**
 * Shares the dock pointer position with icons that are not direct children of
 * `Dock` (for example a scrollable model list). Without this, magnification
 * would silently stop working as soon as an icon is wrapped in a group.
 */
const DockPointerContext = React.createContext<DockPointerState | null>(null)

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = DEFAULT_SIZE,
      iconMagnification = DEFAULT_MAGNIFICATION,
      disableMagnification = DEFAULT_DISABLEMAGNIFICATION,
      iconDistance = DEFAULT_DISTANCE,
      direction = 'middle',
      orientation = 'horizontal',
      ...props
    },
    ref
  ) => {
    const mouseX = useMotionValue(Infinity)

    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        // DockIcon measures distances against getBoundingClientRect(), which is
        // viewport-relative. pageX/pageY include document scroll, so a scrolled
        // page made the magnification point drift away from the cursor.
        mouseX.set(orientation === 'vertical' ? event.clientY : event.clientX)
      },
      [mouseX, orientation]
    )

    const handleMouseLeave = useCallback(() => {
      mouseX.set(Infinity)
    }, [mouseX])

    const renderChildren = () => {
      return React.Children.map(children, (child) => {
        if (React.isValidElement<DockIconProps>(child) && child.type === DockIcon) {
          return React.cloneElement(child, {
            ...child.props,
            mouseX,
            orientation,
            size: iconSize,
            magnification: iconMagnification,
            disableMagnification,
            distance: iconDistance
          })
        }
        return child
      })
    }

    return (
      <DockPointerContext.Provider value={{ mouseX, orientation }}>
        <motion.div
          ref={ref}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          {...props}
          className={cn(dockVariants({ className }), {
            'items-start': direction === 'top',
            'items-center': direction === 'middle',
            'items-end': direction === 'bottom'
          })}
        >
          {renderChildren()}
        </motion.div>
      </DockPointerContext.Provider>
    )
  }
)

Dock.displayName = 'Dock'

export interface DockIconProps extends Omit<
  MotionProps & React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  size?: number
  magnification?: number
  disableMagnification?: boolean
  distance?: number
  mouseX?: MotionValue<number>
  orientation?: 'horizontal' | 'vertical'
  className?: string
  children?: React.ReactNode
  props?: PropsWithChildren
}

const DockIcon = React.forwardRef<HTMLDivElement, DockIconProps>(function DockIcon(
  {
    size = DEFAULT_SIZE,
    magnification = DEFAULT_MAGNIFICATION,
    disableMagnification,
    distance = DEFAULT_DISTANCE,
    mouseX,
    orientation,
    className,
    children,
    ...props
  },
  forwardedRef
) {
  const ref = useRef<HTMLDivElement>(null)
  const pointer = useContext(DockPointerContext)
  const axis = orientation ?? pointer?.orientation ?? 'horizontal'
  const activeMouseX = mouseX ?? pointer?.mouseX
  const fallbackMouseX = useMotionValue(Infinity)
  const padding = Math.max(6, size * 0.2)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mediaQuery) return
    setPrefersReducedMotion(mediaQuery.matches)
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
    mediaQuery.addEventListener?.('change', handleChange)
    return () => mediaQuery.removeEventListener?.('change', handleChange)
  }, [])

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef]
  )

  const distanceCalc = useTransform(activeMouseX ?? fallbackMouseX, (value: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    }
    return axis === 'vertical'
      ? value - bounds.y - bounds.height / 2
      : value - bounds.x - bounds.width / 2
  })

  const targetSize = disableMagnification || prefersReducedMotion ? size : magnification

  const sizeTransform = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [size, targetSize, size]
  )

  // Soft, low-bounce spring: the icon grows a little as the pointer passes,
  // without the exaggerated bounce a stiff default produces.
  const scaleSize = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 24
  })

  return (
    <motion.div
      ref={setRefs}
      style={{ width: scaleSize, height: scaleSize, padding }}
      className={cn(
        'flex aspect-square cursor-pointer items-center justify-center rounded-full transition-transform active:scale-[0.97]',
        disableMagnification && 'hover:bg-muted-foreground transition-colors',
        className
      )}
      {...props}
    >
      <div>{children}</div>
    </motion.div>
  )
})

DockIcon.displayName = 'DockIcon'

export { Dock, DockIcon, dockVariants }
