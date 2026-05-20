import { memo } from 'react'
import { cn } from '@shared/lib/uiUtils'
import { useLanguageStrings } from '@app/providers'

interface SendModeBarProps {
  autoSend: boolean
  onToggle: () => void
}

function SendModeBar({ autoSend, onToggle }: SendModeBarProps) {
  const { t } = useLanguageStrings()

  return (
    <div className="px-3.5 pb-2">
      <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5">
        <button
          type="button"
          onClick={() => {
            if (autoSend) onToggle()
          }}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-all',
            !autoSend
              ? 'bg-white/[0.1] text-white/80 shadow-sm'
              : 'text-white/45 hover:text-white/60'
          )}
          aria-pressed={!autoSend}
        >
          {t('ai_send_mode_send_now')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!autoSend) onToggle()
          }}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault()
              onToggle()
            }
          }}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-all',
            autoSend
              ? 'bg-emerald-500/[0.15] text-emerald-300/90 shadow-sm'
              : 'text-white/45 hover:text-white/60'
          )}
          aria-pressed={autoSend}
        >
          {t('ai_send_mode_auto')}
        </button>
      </div>
    </div>
  )
}

export default memo(SendModeBar)
