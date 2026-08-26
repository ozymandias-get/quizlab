import { cn } from '@shared/lib/uiUtils'

import type { ISourceOptions } from '@tsparticles/engine'
import { type Container, tsParticles } from '@tsparticles/engine'
import Particles from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import { motion, useAnimation } from 'motion/react'
import { useId, useMemo, useRef } from 'react'
import { useEffect, useState } from 'react'

import { createSparklesOptions } from './sparklesConfig'

type ParticlesProps = {
  id?: string
  className?: string
  background?: string
  particleSize?: number
  minSize?: number
  maxSize?: number
  speed?: number
  particleColor?: string
  particleDensity?: number
}

type SparklesCoreProps = ParticlesProps & { paused?: boolean }

let slimLoadPromise: Promise<void> | null = null
function ensureSlimLoaded(): Promise<void> {
  if (!slimLoadPromise) {
    slimLoadPromise = loadSlim(tsParticles)
  }
  return slimLoadPromise
}

const SparklesCore = (props: SparklesCoreProps) => {
  const {
    id,
    className,
    background,
    minSize,
    maxSize,
    speed,
    particleColor,
    particleDensity,
    paused = false
  } = props
  const [init, setInit] = useState(false)
  const isMountedRef = useRef(true)
  const containerRef = useRef<Container | null>(null)
  const [isPageHidden, setIsPageHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false
  )
  const effectivelyPaused = paused || isPageHidden

  useEffect(() => {
    isMountedRef.current = true
    // Defer heavy engine init to idle to avoid blocking initial paint.
    const schedule = (cb: () => void) => {
      const ric = (
        window as unknown as {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        }
      ).requestIdleCallback
      if (typeof ric === 'function') return ric.call(window, cb, { timeout: 2000 })
      return window.setTimeout(cb, 300) as unknown as number
    }
    const cancelSchedule = (handle: number) => {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback
      if (typeof cic === 'function') return cic.call(window, handle)
      return clearTimeout(handle)
    }
    const handle = schedule(() => {
      void ensureSlimLoaded().then(() => {
        if (isMountedRef.current) setInit(true)
      })
    })
    return () => {
      isMountedRef.current = false
      cancelSchedule(handle)
    }
  }, [])

  // Pause / resume the animation loop when hidden (e.g. during panel resize or when tab hidden).
  useEffect(() => {
    const container = containerRef.current as unknown as {
      pause?: () => void
      play?: (b?: boolean) => void
    } | null
    if (!container) return
    if (effectivelyPaused) container.pause?.()
    else container.play?.(true)
  }, [effectivelyPaused])

  useEffect(() => {
    const handleVisibility = () => setIsPageHidden(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const controls = useAnimation()

  const particlesLoaded = async (container?: Container) => {
    containerRef.current = container ?? null
    if (container) {
      // Respect initial paused state — pause immediately if needed.
      if (effectivelyPaused) (container as unknown as { pause?: () => void }).pause?.()
      controls.start({ opacity: 1, transition: { duration: 1 } })
    }
  }

  const options: ISourceOptions = useMemo(
    () =>
      createSparklesOptions(background, particleColor, particleDensity, minSize, maxSize, speed),
    [background, particleColor, particleDensity, minSize, maxSize, speed]
  )

  const generatedId = useId()
  return (
    <motion.div animate={controls} className={cn('opacity-0', className)}>
      {init && !effectivelyPaused && (
        <Particles
          id={id || generatedId}
          className={cn('h-full w-full')}
          particlesLoaded={particlesLoaded}
          options={options}
        />
      )}
    </motion.div>
  )
}

export default SparklesCore
