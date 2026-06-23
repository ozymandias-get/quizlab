import { cn } from '@app/lib/utils'

import { memo, useCallback, useEffect, useRef } from 'react'

interface GlowingEffectProps {
  blur?: number
  inactiveZone?: number
  proximity?: number
  spread?: number
  variant?: 'default' | 'white'
  glow?: boolean
  className?: string
  disabled?: boolean
  borderWidth?: number
}

const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 20,
    variant = 'default',
    glow = false,
    className,
    borderWidth = 1,
    disabled = true
  }: GlowingEffectProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const rectRef = useRef<DOMRect | null>(null)
    const isVisibleRef = useRef(true)

    useEffect(() => {
      if (disabled || !containerRef.current) return

      const container = containerRef.current

      rectRef.current = container.getBoundingClientRect()

      const ro = new ResizeObserver(() => {
        rectRef.current = container.getBoundingClientRect()
      })
      ro.observe(container)

      const io = new IntersectionObserver(
        ([entry]) => {
          isVisibleRef.current = entry.isIntersecting
        },
        { rootMargin: '100px' }
      )
      io.observe(container)

      let scrollRafId: number | null = null
      const handleScroll = () => {
        if (scrollRafId !== null) return
        scrollRafId = requestAnimationFrame(() => {
          scrollRafId = null
          rectRef.current = container.getBoundingClientRect()
        })
      }
      window.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        ro.disconnect()
        io.disconnect()
        window.removeEventListener('scroll', handleScroll)
        if (scrollRafId !== null) cancelAnimationFrame(scrollRafId)
      }
    }, [disabled])

    const handlePointerMove = useCallback(
      (e: PointerEvent) => {
        const element = containerRef.current
        const rect = rectRef.current
        if (!element || !rect || !isVisibleRef.current) return

        const mouseX = e.x
        const mouseY = e.y
        const centerX = rect.left + rect.width * 0.5
        const centerY = rect.top + rect.height * 0.5

        if (
          Math.hypot(mouseX - centerX, mouseY - centerY) <
          0.5 * Math.min(rect.width, rect.height) * inactiveZone
        ) {
          element.style.setProperty('--active', '0')
          return
        }

        const isActive =
          mouseX > rect.left - proximity &&
          mouseX < rect.left + rect.width + proximity &&
          mouseY > rect.top - proximity &&
          mouseY < rect.top + rect.height + proximity

        element.style.setProperty('--active', isActive ? '1' : '0')
        if (!isActive) return

        element.style.setProperty(
          '--start',
          String((180 * Math.atan2(mouseY - centerY, mouseX - centerX)) / Math.PI + 90)
        )
      },
      [inactiveZone, proximity]
    )

    useEffect(() => {
      if (disabled) return
      const container = containerRef.current
      if (!container) return
      container.addEventListener('pointermove', handlePointerMove, { passive: true })
      return () => {
        container.removeEventListener('pointermove', handlePointerMove)
      }
    }, [disabled, handlePointerMove])

    return (
      <>
        <div
          className={cn(
            'pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity',
            glow && 'opacity-100',
            variant === 'white' && 'border-white',
            disabled && '!block'
          )}
        />
        <div
          ref={containerRef}
          style={
            {
              '--blur': `${blur}px`,
              '--spread': spread,
              '--start': '0',
              '--active': '0',
              '--glowingeffect-border-width': `${borderWidth}px`,
              '--repeating-conic-gradient-times': '5',
              '--gradient':
                variant === 'white'
                  ? `repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  var(--black),
                  var(--black) calc(25% / var(--repeating-conic-gradient-times))
                )`
                  : `radial-gradient(circle, #dd7bbb 10%, #dd7bbb00 20%),
                radial-gradient(circle at 40% 40%, #d79f1e 5%, #d79f1e00 15%),
                radial-gradient(circle at 60% 60%, #5a922c 10%, #5a922c00 20%), 
                radial-gradient(circle at 40% 60%, #4c7894 10%, #4c789400 20%),
                repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  #dd7bbb 0%,
                  #d79f1e calc(25% / var(--repeating-conic-gradient-times)),
                  #5a922c calc(50% / var(--repeating-conic-gradient-times)), 
                  #4c7894 calc(75% / var(--repeating-conic-gradient-times)),
                  #dd7bbb calc(100% / var(--repeating-conic-gradient-times))
                )`
            } as React.CSSProperties
          }
          className={cn(
            'pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity will-change-transform',
            glow && 'opacity-100',
            blur > 0 && 'blur-[var(--blur)]',
            className,
            disabled && '!hidden'
          )}
        >
          <div
            className={cn(
              'glow',
              'rounded-[inherit]',
              'after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))] after:rounded-[inherit] after:content-[""]',
              'after:[border:var(--glowingeffect-border-width)_solid_transparent]',
              'after:[background-attachment:fixed] after:[background:var(--gradient)]',
              'after:opacity-[var(--active)] after:transition-opacity after:duration-300',
              'after:[mask-clip:padding-box,border-box]',
              'after:[mask-composite:intersect]',
              'after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]'
            )}
          />
        </div>
      </>
    )
  }
)

GlowingEffect.displayName = 'GlowingEffect'

export { GlowingEffect }
