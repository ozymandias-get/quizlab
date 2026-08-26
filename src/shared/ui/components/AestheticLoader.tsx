import { useReducedMotion } from 'motion/react'
import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const AestheticLoader = memo(function AestheticLoader() {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion() ?? false

  const [msgIndex, setMsgIndex] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMsgIndex(Math.floor(Math.random() * 20) + 1)

    if (prefersReducedMotion) return

    const visible = containerRef.current?.closest<HTMLElement>('[style*="display: none"], [hidden]')
    if (visible) return

    let intervalId: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (intervalId !== null || document.hidden) return
      intervalId = setInterval(() => {
        if (document.hidden) return
        setMsgIndex(Math.floor(Math.random() * 20) + 1)
      }, 4000)
    }

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    start()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [prefersReducedMotion])

  return (
    <div ref={containerRef} className="aesthetic-loader-modern">
      <div className="ambient" />
      <div className="grid" />

      <div className="shell">
        <section className="brand">
          <div className="markWrap">
            <div className="markGlow" />
            <svg className="mark" viewBox="0 0 56 56" aria-hidden="true">
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                className="text-primary/40"
                strokeWidth="3"
              />
              <path
                d="M12 30 H20 L23 22 L28 35 L33 16 L37 39 L40 30 H45"
                fill="none"
                stroke="currentColor"
                className="text-primary"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <h2 className="title">{t('app_name')}</h2>
            <p className="subtitle">{t('splash_initializing')}</p>
          </div>
        </section>

        <div className="meter">
          <div className="meterBar" />
        </div>

        <section className="statusRow">
          <div className="statusDot" />
          <p className="statusText">{t(`loader_msg_${msgIndex}`)}</p>
        </section>
      </div>
    </div>
  )
})

export default AestheticLoader
