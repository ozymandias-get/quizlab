import { memo } from 'react'
import { useDiagnosticsStore } from '@features/diagnostics'
import { TerminalIcon } from '@ui/components/Icons'

interface DiagnosticsQuickViewProps {
  t: (key: string) => string
}

const DiagnosticsQuickView = memo(({ t }: DiagnosticsQuickViewProps) => {
  const enabled = useDiagnosticsStore((s) => s.enabled)
  const totalSends = useDiagnosticsStore((s) => s.totalSends)
  const averageSendTime = useDiagnosticsStore((s) => s.averageSendTime)
  const lastError = useDiagnosticsStore((s) => s.lastError)
  const providerDegraded = useDiagnosticsStore((s) => s.providerDegraded)
  const currentProvider = useDiagnosticsStore((s) => s.currentProvider)
  const eventsLength = useDiagnosticsStore((s) => s.events.length)

  if (!enabled) return null

  return (
    <div className="rounded-[24px] border border-white/[0.12] bg-white/[0.04] p-5">
      <div className="flex items-center gap-4">
        <div className="rounded-xl border border-white/[.15] bg-white/[0.08] p-2.5 text-white/60">
          <TerminalIcon className="w-6 h-6" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-ql-14 font-bold text-white">{t('diagnostics')}</h4>
          <p className="text-ql-12 text-white/40">{t('diagnostics_quick_desc')}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-white/[0.03] p-3">
          <div className="text-white/36 text-[10px] font-medium">
            {t('diagnostics_stat_total_sends')}
          </div>
          <div className="text-white/88 font-bold text-ql-16">{totalSends}</div>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <div className="text-white/36 text-[10px] font-medium">
            {t('diagnostics_stat_avg_send_time')}
          </div>
          <div className="text-white/88 font-bold text-ql-16">
            {averageSendTime < 1000
              ? `${Math.round(averageSendTime)}ms`
              : `${(averageSendTime / 1000).toFixed(2)}s`}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <div className="text-white/36 text-[10px] font-medium">
            {t('diagnostics_stat_current_provider')}
          </div>
          <div className="text-white/88 font-bold text-ql-14 truncate">
            {currentProvider || 'none'}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <div className="text-white/36 text-[10px] font-medium">Durum</div>
          <div
            className={`font-bold text-ql-14 flex items-center gap-1.5 ${
              providerDegraded ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                providerDegraded
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse'
              }`}
            />
            {providerDegraded ? 'Zayıflamış' : 'Sağlıklı'}
          </div>
        </div>
      </div>

      {lastError && (
        <div className="mt-3 bg-rose-950/20 border border-rose-500/15 rounded-xl p-3 text-rose-300 text-ql-12 font-mono break-all">
          {lastError}
        </div>
      )}

      <div className="mt-3 text-[10px] text-white/30">{eventsLength} olay kaydedildi</div>
    </div>
  )
})

DiagnosticsQuickView.displayName = 'DiagnosticsQuickView'
export default DiagnosticsQuickView
