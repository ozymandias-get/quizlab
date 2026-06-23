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
      className="group flex flex-1 cursor-pointer flex-col items-center justify-center bg-black/40 backdrop-blur-sm select-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
    >
      <div className="bg-card/80 border-border mb-4 rounded-2xl border p-4 shadow-xl transition-transform group-hover:scale-105 active:scale-95">
        <Moon className="text-muted-foreground h-8 w-8" />
      </div>
      <p className="text-foreground text-ql-20 font-medium">{t('ai_session.sleep_title')}</p>
      <p className="text-ql-13 text-muted-foreground mt-1 max-w-sm px-6 text-center">
        {t('ai_session.sleep_description')}
      </p>
    </div>
  )
}

export const SleepPlaceholderView = memo(SleepPlaceholderViewImpl)
SleepPlaceholderView.displayName = 'SleepPlaceholderView'

export default SleepPlaceholderView
