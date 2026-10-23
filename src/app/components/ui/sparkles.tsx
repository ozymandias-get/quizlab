import { cn } from '@shared/lib/uiUtils'

import { memo, useEffect, useRef, useState } from 'react'

export type ParticlesProps = {
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

export type SparklesCoreProps = ParticlesProps & { paused?: boolean }

interface Particle {
  x: number
  y: number
  size: number
  alpha: number
  alphaTarget: number
  vx: number
  vy: number
}

export const SparklesCore = memo((props: SparklesCoreProps) => {
  const {
    id,
    className,
    background = 'transparent',
    minSize = 0.4,
    maxSize = 0.9,
    speed = 0.6,
    particleColor = '#FFFFFF',
    particleDensity = 5,
    paused = false
  } = props

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isPageHidden, setIsPageHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false
  )

  const effectivelyPaused = paused || isPageHidden
  const effectivelyPausedRef = useRef(effectivelyPaused)
  effectivelyPausedRef.current = effectivelyPaused

  useEffect(() => {
    const handleVisibility = () => setIsPageHidden(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number | null = null
    let particles: Particle[] = []
    let width = 0
    let height = 0

    const initParticles = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))

      canvas.width = width
      canvas.height = height

      const count = Math.min(
        25,
        Math.max(6, Math.floor((width * height) / (2000 / Math.max(1, particleDensity))))
      )
      particles = []

      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: minSize + Math.random() * (maxSize - minSize),
          alpha: 0.1 + Math.random() * 0.7,
          alphaTarget: 0.1 + Math.random() * 0.7,
          vx: (Math.random() - 0.5) * speed * 0.4,
          vy: (Math.random() - 0.5) * speed * 0.4
        })
      }
    }

    initParticles()

    const render = () => {
      if (!effectivelyPausedRef.current && width > 0 && height > 0) {
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = particleColor

        for (const p of particles) {
          p.x += p.vx
          p.y += p.vy

          if (p.x < 0) p.x = width
          else if (p.x > width) p.x = 0

          if (p.y < 0) p.y = height
          else if (p.y > height) p.y = 0

          // Smooth twinkle
          if (Math.abs(p.alpha - p.alphaTarget) < 0.02) {
            p.alphaTarget = 0.1 + Math.random() * 0.8
          } else {
            p.alpha += (p.alphaTarget - p.alpha) * 0.03
          }

          ctx.globalAlpha = p.alpha
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    const resizeObserver = new ResizeObserver(() => {
      initParticles()
    })
    resizeObserver.observe(canvas)

    return () => {
      if (animId !== null) cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      canvas.width = 0
      canvas.height = 0
    }
  }, [minSize, maxSize, speed, particleColor, particleDensity])

  return (
    <canvas
      id={id}
      ref={canvasRef}
      data-testid="sparkles-core"
      style={{ background }}
      className={cn('pointer-events-none block h-full w-full', className)}
    />
  )
})

SparklesCore.displayName = 'SparklesCore'

export default SparklesCore
