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
      className="group bg-background/60 focus-visible:ring-ring/40 flex flex-1 cursor-pointer flex-col items-center justify-center backdrop-blur-sm select-none focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="border-border bg-card group-hover:border-primary/40 group-hover:bg-muted mb-4 rounded-xl border p-4 shadow-xs transition-colors">
        <Moon className="text-primary/80 h-8 w-8" />
      </div>
      <p className="text-ql-18 text-foreground font-semibold">{t('ai_session.sleep_title')}</p>
      <p className="text-ql-13 text-muted-foreground mt-1 max-w-sm px-6 text-center">
        {t('ai_session.sleep_description')}
      </p>
    </div>
  )
}

export const SleepPlaceholderView = memo(SleepPlaceholderViewImpl)
SleepPlaceholderView.displayName = 'SleepPlaceholderView'

export default SleepPlaceholderView
