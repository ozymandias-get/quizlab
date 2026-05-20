import { memo } from 'react'
import { Zap, MousePointer2 } from 'lucide-react'
import { cn } from '@shared/lib/uiUtils'
import { useLanguageStrings } from '@app/providers'

interface SendModeBarProps {
  autoSend: boolean
  onToggle: () => void
}

function SendModeBar({ autoSend, onToggle }: SendModeBarProps) {
  const { t } = useLanguageStrings()

  return (
    <div className="px-4 pb-2">
      <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-0.5 border border-white/[0.06]">
        <button
          type="button"
          onClick={() => {
            if (autoSend) onToggle()
          }}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all',
            !autoSend
              ? 'bg-white/[0.12] text-white shadow-sm'
              : 'text-white/55 hover:text-white/75 hover:bg-white/[0.06]'
          )}
          aria-pressed={!autoSend}
        >
          <MousePointer2 className="h-3.5 w-3.5" strokeWidth={2} />
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
            'flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all',
            autoSend
              ? 'bg-emerald-500/[0.18] text-emerald-300 shadow-sm'
              : 'text-white/55 hover:text-white/75 hover:bg-white/[0.06]'
          )}
          aria-pressed={autoSend}
        >
          <Zap className="h-3.5 w-3.5" strokeWidth={2} />
          {t('ai_send_mode_auto')}
        </button>
      </div>
    </div>
  )
}

export default memo(SendModeBar)
