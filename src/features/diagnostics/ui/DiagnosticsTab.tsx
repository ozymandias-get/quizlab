import { memo } from 'react'
import { useDiagnosticsStore } from '../store/diagnosticsStore'
import { TerminalIcon, TrashIcon } from '@ui/components/Icons'

interface DiagnosticsTabProps {
  t: (key: string) => string
}

const DiagnosticsTab = memo(function DiagnosticsTab({ t }: DiagnosticsTabProps) {
  const {
    enabled,
    events,
    lastError,
    providerDegraded,
    currentProvider,
    totalSends,
    averageSendTime,
    reset,
    setEnabled
  } = useDiagnosticsStore()

  const severityColor: Record<string, string> = {
    info: 'text-blue-400',
    warn: 'text-amber-400',
    error: 'text-rose-400'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/[.15] bg-white/[0.08] p-2.5 text-white/60">
            <TerminalIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-ql-16 font-bold text-white">{t('diagnostics')}</h3>
            <p className="text-ql-12 text-white/40">{t('diagnostics_description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/60 hover:text-white/80 bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            {t('diagnostics_reset')}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-ql-14 font-semibold text-white/80">{t('diagnostics_settings')}</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-white/50">{t('diagnostics_enabled')}</span>
            <div
              onClick={() => setEnabled(!enabled)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                enabled ? 'bg-emerald-500' : 'bg-white/20'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
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
            <div className="text-white/36 text-[10px] font-medium">
              {t('diagnostics_stat_status')}
            </div>
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
              {providerDegraded
                ? t('diagnostics_status_degraded')
                : t('diagnostics_status_healthy')}
            </div>
          </div>
        </div>

        {lastError && (
          <div className="mt-4 bg-rose-950/20 border border-rose-500/15 rounded-xl p-3 text-rose-300 text-ql-12 font-mono break-all">
            <div className="text-[10px] text-rose-400/60 mb-1">{t('diagnostics_last_error')}</div>
            {lastError}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-5">
        <h4 className="text-ql-14 font-semibold text-white/80 mb-3">
          {t('diagnostics_events')} ({events.length})
        </h4>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-sm">
              {t('diagnostics_no_events')}
            </div>
          ) : (
            events
              .slice()
              .reverse()
              .slice(0, 50)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 text-xs p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                      event.severity === 'error'
                        ? 'bg-rose-400'
                        : event.severity === 'warn'
                          ? 'bg-amber-400'
                          : 'bg-blue-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-medium ${severityColor[event.severity] || 'text-white/60'}`}
                    >
                      {event.type}
                    </div>
                    <div className="text-white/40 text-[10px] truncate">
                      {event.message}
                      {event.provider && ` • ${event.provider}`}
                    </div>
                  </div>
                  {event.duration && (
                    <span className="text-white/30 text-[10px] flex-shrink-0">
                      {event.duration < 1000
                        ? `${Math.round(event.duration)}ms`
                        : `${(event.duration / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
})

export default DiagnosticsTab
