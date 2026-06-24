import { cn } from '@app/lib/appUtils'

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

const SparklesCore = (props: ParticlesProps) => {
  const { id, className, background, minSize, maxSize, speed, particleColor, particleDensity } =
    props
  const [init, setInit] = useState(false)
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    loadSlim(tsParticles).then(() => {
      if (isMountedRef.current) setInit(true)
    })
    return () => {
      isMountedRef.current = false
    }
  }, [])
  const controls = useAnimation()

  const particlesLoaded = async (container?: Container) => {
    if (container) {
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
      {init && (
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
