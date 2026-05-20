import { memo, useState } from 'react'
import { useDiagnosticsStore } from '../store/diagnosticsStore'
import { XIcon, TerminalIcon, ChevronRightIcon } from '@ui/components/Icons'

const DiagnosticsPanel = memo(function DiagnosticsPanel() {
  const {
    events,
    lastError,
    providerDegraded,
    currentProvider,
    totalSends,
    averageSendTime,
    reset
  } = useDiagnosticsStore()
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)

  if (!visible) return null

  const severityColor: Record<string, string> = {
    info: 'text-blue-400',
    warn: 'text-amber-400',
    error: 'text-rose-400'
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-96 rounded-2xl border border-white/[0.12] bg-gray-900/95 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between p-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-white/60" />
          <span className="text-white/80 text-sm font-medium">Diagnostics</span>
          {providerDegraded && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRightIcon
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
          <button
            onClick={() => setVisible(false)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-2 overflow-y-auto max-h-72">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/[0.04] p-2">
              <div className="text-white/40 text-[10px]">Total Sends</div>
              <div className="text-white/80 font-bold">{totalSends}</div>
            </div>
            <div className="rounded-lg bg-white/[0.04] p-2">
              <div className="text-white/40 text-[10px]">Avg Time</div>
              <div className="text-white/80 font-bold">
                {averageSendTime < 1000
                  ? `${Math.round(averageSendTime)}ms`
                  : `${(averageSendTime / 1000).toFixed(2)}s`}
              </div>
            </div>
          </div>

          {currentProvider && (
            <div className="rounded-lg bg-white/[0.04] p-2 text-xs">
              <div className="text-white/40 text-[10px]">Provider</div>
              <div className="text-white/80 font-medium">{currentProvider}</div>
            </div>
          )}

          {lastError && (
            <div className="rounded-lg bg-rose-950/30 border border-rose-500/20 p-2 text-rose-300 text-xs font-mono break-all">
              {lastError}
            </div>
          )}

          <div className="space-y-1">
            {events
              .slice(-20)
              .reverse()
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 text-xs p-1.5 rounded-lg hover:bg-white/[0.04]"
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
                    <div className="text-white/40 text-[10px] truncate">{event.message}</div>
                  </div>
                  {event.duration && (
                    <span className="text-white/30 text-[10px] flex-shrink-0">
                      {event.duration < 1000
                        ? `${Math.round(event.duration)}ms`
                        : `${(event.duration / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>
              ))}
          </div>

          <button
            onClick={reset}
            className="w-full py-1.5 text-xs text-white/40 hover:text-white/60 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  )
})

export default DiagnosticsPanel
