import { cn } from '@shared/lib/uiUtils'

import { cva, type VariantProps } from 'class-variance-authority'
import {
  motion,
  type MotionProps,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform
} from 'motion/react'
import React, {
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef
} from 'react'

interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string
  style?: React.CSSProperties
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
  scrollTick: MotionValue<number>
  disableMagnification: boolean
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
    const scrollTick = useMotionValue(0)

    useEffect(() => {
      if (disableMagnification) {
        mouseX.set(Infinity)
      }
    }, [disableMagnification, mouseX])

    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (disableMagnification) return
        // DockIcon measures distances against getBoundingClientRect(), which is
        // viewport-relative. pageX/pageY include document scroll, so a scrolled
        // page made the magnification point drift away from the cursor.
        mouseX.set(orientation === 'vertical' ? event.clientY : event.clientX)
      },
      [disableMagnification, mouseX, orientation]
    )

    const handleMouseLeave = useCallback(() => {
      mouseX.set(Infinity)
    }, [mouseX])

    const handleScrollCapture = useCallback(() => {
      if (disableMagnification || mouseX.get() === Infinity) return
      scrollTick.set(scrollTick.get() + 1)
    }, [disableMagnification, mouseX, scrollTick])

    const pointerContextValue = useMemo(
      () => ({ mouseX, orientation, scrollTick, disableMagnification }),
      [mouseX, orientation, scrollTick, disableMagnification]
    )

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
      <DockPointerContext.Provider value={pointerContextValue}>
        <motion.div
          ref={ref}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onScrollCapture={handleScrollCapture}
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

interface DockIconProps extends Omit<
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
  const slotRef = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const pointer = useContext(DockPointerContext)
  const axis = orientation ?? pointer?.orientation ?? 'horizontal'
  const activeMouseX = mouseX ?? pointer?.mouseX
  const isMagnificationDisabled = disableMagnification ?? pointer?.disableMagnification ?? false
  const fallbackMouseX = useMotionValue(Infinity)
  const fallbackScrollTick = useMotionValue(0)
  const activeScrollTick = pointer?.scrollTick ?? fallbackScrollTick
  const padding = Math.max(6, size * 0.2)
  const prefersReducedMotion = useReducedMotion()

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef]
  )

  const distanceCalc = useTransform(
    [activeMouseX ?? fallbackMouseX, activeScrollTick],
    ([value]: number[]) => {
      const bounds = slotRef.current?.getBoundingClientRect() ?? {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      }
      return axis === 'vertical'
        ? value - bounds.y - bounds.height / 2
        : value - bounds.x - bounds.width / 2
    }
  )

  const targetSize = isMagnificationDisabled || prefersReducedMotion ? size : magnification
  const targetScale = size > 0 ? targetSize / size : 1

  const scaleTransform = useTransform(distanceCalc, [-distance, 0, distance], [1, targetScale, 1])

  // Soft, low-bounce spring: the icon grows a little as the pointer passes,
  // without the exaggerated bounce a stiff default produces.
  const scale = useSpring(scaleTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 24
  })

  return (
    <div
      ref={slotRef}
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <motion.div
        ref={setRefs}
        style={{ width: size, height: size, padding }}
        className={cn(
          'group flex aspect-square cursor-pointer items-center justify-center rounded-full',
          isMagnificationDisabled && 'hover:bg-muted-foreground transition-colors',
          className
        )}
        {...props}
      >
        {/* Only the visual icon scales. The button box, hover surface and
            tooltip anchor stay fixed, so magnification cannot pull the pointer
            hitbox out from under the cursor. */}
        <motion.div
          style={{ scale, transformOrigin: 'center center', willChange: 'transform' }}
          className="pointer-events-none flex size-full items-center justify-center"
        >
          <div className="transition-transform group-active:scale-[0.97]">{children}</div>
        </motion.div>
      </motion.div>
    </div>
  )
})

DockIcon.displayName = 'DockIcon'

export { Dock, DockIcon }
