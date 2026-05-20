import { memo } from 'react'
import type { TelemetryMetrics } from '../model/types'

interface MetricsSummaryProps {
  metrics: TelemetryMetrics
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

const MetricsSummary = memo(function MetricsSummary({ metrics }: MetricsSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Avg Send Duration</div>
        <div className="text-white/70 font-mono">
          {metrics.averageSendDuration < 1000
            ? `${Math.round(metrics.averageSendDuration)}ms`
            : `${(metrics.averageSendDuration / 1000).toFixed(1)}s`}
        </div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Failed Send Ratio</div>
        <div
          className={`font-mono ${metrics.failedSendRatio > 0.2 ? 'text-red-400' : 'text-white/70'}`}
        >
          {formatRatio(metrics.failedSendRatio)}
        </div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Cache Hit Ratio</div>
        <div className="text-white/70 font-mono">{formatRatio(metrics.cacheHitRatio)}</div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Fallback Usage</div>
        <div className="text-white/70 font-mono">{formatRatio(metrics.fallbackUsageRatio)}</div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Selector Recovery</div>
        <div className="text-white/70 font-mono">{formatRatio(metrics.selectorRecoveryRate)}</div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Upload Success</div>
        <div className="text-white/70 font-mono">{formatRatio(metrics.uploadSuccessRatio)}</div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Timeouts</div>
        <div
          className={`font-mono ${metrics.timeoutCount > 0 ? 'text-yellow-400' : 'text-white/70'}`}
        >
          {metrics.timeoutCount}
        </div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Retries</div>
        <div
          className={`font-mono ${metrics.retryCount > 0 ? 'text-yellow-400' : 'text-white/70'}`}
        >
          {metrics.retryCount}
        </div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">WebView Crashes</div>
        <div
          className={`font-mono ${metrics.webviewCrashCount > 0 ? 'text-red-400' : 'text-white/70'}`}
        >
          {metrics.webviewCrashCount}
        </div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">JS Errors</div>
        <div
          className={`font-mono ${metrics.executeJsErrorCount > 0 ? 'text-red-400' : 'text-white/70'}`}
        >
          {metrics.executeJsErrorCount}
        </div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Recovery Success</div>
        <div className="text-white/70 font-mono">{formatRatio(metrics.recoverySuccessRatio)}</div>
      </div>

      <div className="bg-white/5 rounded p-2">
        <div className="text-white/40 text-[10px]">Stale Webviews</div>
        <div
          className={`font-mono ${metrics.staleWebviewCount > 0 ? 'text-yellow-400' : 'text-white/70'}`}
        >
          {metrics.staleWebviewCount}
        </div>
      </div>
    </div>
  )
})

export default MetricsSummary
