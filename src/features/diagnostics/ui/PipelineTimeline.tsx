import { useMemo } from 'react'
import type { DiagnosticsEvent } from '../model/types'

interface PipelineTimelineEvent extends DiagnosticsEvent {
  relativeMs: number
  index: number
}

interface PipelineTimelineProps {
  events: DiagnosticsEvent[]
  provider?: string
}

function formatMs(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)}μs`
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getStageIcon(stage: string): string {
  switch (stage) {
    case 'queue':
      return '⏳'
    case 'config_resolve':
      return '⚙️'
    case 'clipboard':
      return '📋'
    case 'focus':
      return '🎯'
    case 'paste':
      return '📌'
    case 'prompt':
      return '💬'
    case 'script_generation':
      return '📝'
    case 'script_execution':
      return '▶️'
    case 'submit_ready':
      return '✅'
    case 'click':
      return '🖱️'
    case 'complete':
      return '🏁'
    case 'error':
      return '❌'
    default:
      return '•'
  }
}

function getStageColor(stage: string): string {
  switch (stage) {
    case 'error':
      return 'text-red-400'
    case 'complete':
      return 'text-green-400'
    case 'submit_ready':
      return 'text-emerald-400'
    case 'script_execution':
      return 'text-teal-400'
    case 'script_generation':
      return 'text-cyan-400'
    case 'config_resolve':
      return 'text-blue-400'
    case 'clipboard':
      return 'text-purple-400'
    case 'paste':
      return 'text-pink-400'
    case 'focus':
      return 'text-indigo-400'
    case 'queue':
      return 'text-gray-400'
    default:
      return 'text-white/60'
  }
}

export default function PipelineTimeline({ events, provider }: PipelineTimelineProps) {
  const lastPipelineEvents = useMemo(() => {
    const filtered = provider ? events.filter((e) => e.provider === provider) : events

    if (filtered.length === 0) return []

    let lastSendStartIndex = -1
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (filtered[i].type === 'SEND_START') {
        lastSendStartIndex = i
        break
      }
    }

    if (lastSendStartIndex === -1) return filtered.slice(-15) as PipelineTimelineEvent[]

    const pipelineEvents = filtered.slice(lastSendStartIndex)

    let baseTime = pipelineEvents[0].timestamp
    return pipelineEvents.map((e, i) => ({
      ...e,
      relativeMs: i === 0 ? 0 : e.timestamp - baseTime,
      index: i
    })) as PipelineTimelineEvent[]
  }, [events, provider])

  const averageTiming = useMemo(() => {
    if (lastPipelineEvents.length === 0) return null
    const totalDuration = lastPipelineEvents[lastPipelineEvents.length - 1].relativeMs ?? 0
    return totalDuration
  }, [lastPipelineEvents])

  if (lastPipelineEvents.length === 0) {
    return <div className="px-3 py-4 text-center text-white/30 text-xs">No pipeline data yet</div>
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1 text-[10px] text-white/40">
        <span>Pipeline Timeline</span>
        {averageTiming !== null && averageTiming > 0 && (
          <span>Total: {formatMs(averageTiming)}</span>
        )}
      </div>

      <div className="space-y-0.5">
        {lastPipelineEvents.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-white/5 rounded transition-colors"
          >
            <span className="w-4 text-center text-[10px]">{getStageIcon(event.pipelineStage)}</span>
            <span
              className={`w-20 shrink-0 font-mono text-[10px] ${getStageColor(event.pipelineStage)}`}
            >
              [{event.relativeMs !== undefined ? formatMs(event.relativeMs) : '-'}]
            </span>
            <span
              className={`font-mono text-[10px] ${event.severity === 'error' ? 'text-red-400' : 'text-white/60'}`}
            >
              {event.type}
            </span>
            {event.duration !== undefined && (
              <span className="text-white/30 text-[10px] ml-auto">{formatMs(event.duration)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
