import { BlurFade } from '@app/components/ui/blur-fade'

import { Moon } from 'lucide-react'
import { memo } from 'react'

interface SleepPlaceholderViewProps {
  onWakeUp: () => void
  t: (key: string) => string
}

function SleepPlaceholderViewImpl({ onWakeUp, t }: SleepPlaceholderViewProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onWakeUp}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onWakeUp()
        }
      }}
      className="group focus-visible:ring-ring/70 flex flex-1 cursor-pointer flex-col items-center justify-center bg-zinc-950/70 select-none focus-visible:ring-2 focus-visible:outline-none"
    >
      <BlurFade duration={0.35} offset={8} blur="5px">
        <div className="flex max-w-sm flex-col items-center rounded-2xl border border-white/10 bg-zinc-900/90 px-8 py-7 text-center shadow-2xl transition-colors group-hover:border-white/20 group-hover:bg-zinc-900/95">
          <div className="relative mb-4 flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-white/10 motion-safe:animate-ping"
            />
            <Moon className="relative size-7 text-zinc-200" />
          </div>
          <p className="text-ql-17 text-foreground font-semibold">{t('ai_session.sleep_title')}</p>
          <p className="text-ql-12 text-muted-foreground mt-1 max-w-xs leading-relaxed">
            {t('ai_session.sleep_description')}
          </p>
          <span className="text-ql-12 motion-normal mt-4 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-semibold text-zinc-100 transition-colors group-hover:bg-white/15">
            {t('ai_session.wake_action')}
          </span>
        </div>
      </BlurFade>
    </div>
  )
}

const SleepPlaceholderView = memo(SleepPlaceholderViewImpl)
SleepPlaceholderView.displayName = 'SleepPlaceholderView'

export default SleepPlaceholderView
