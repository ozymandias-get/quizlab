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
      className="group bg-background/60 focus-visible:ring-ring/70 flex flex-1 cursor-pointer flex-col items-center justify-center backdrop-blur-sm select-none focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="border-border bg-card group-hover:border-primary/40 group-hover:bg-card/95 flex max-w-sm flex-col items-center rounded-2xl border px-8 py-7 text-center shadow-xs transition-colors">
        <div className="border-border bg-muted/50 relative mb-4 flex size-14 items-center justify-center rounded-full border">
          <span
            aria-hidden
            className="bg-primary/20 absolute inset-0 rounded-full motion-safe:animate-ping"
          />
          <Moon className="text-primary/80 relative size-7" />
        </div>
        <p className="text-ql-17 text-foreground font-semibold">{t('ai_session.sleep_title')}</p>
        <p className="text-ql-12 text-muted-foreground mt-1 max-w-xs leading-relaxed">
          {t('ai_session.sleep_description')}
        </p>
        <span className="border-primary/30 bg-primary/10 text-primary group-hover:bg-primary/15 motion-normal text-ql-12 mt-4 inline-flex items-center rounded-full border px-4 py-1.5 font-semibold transition-colors">
          {t('ai_session.wake_action')}
        </span>
      </div>
    </div>
  )
}

const SleepPlaceholderView = memo(SleepPlaceholderViewImpl)
SleepPlaceholderView.displayName = 'SleepPlaceholderView'

export default SleepPlaceholderView
