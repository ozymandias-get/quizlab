import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import type { DiagnosticsEvent, GroupedError } from '../model/types'
import { getEscalatedSeverity } from '../lib/errorGrouping'

interface EventStreamProps {
  events: DiagnosticsEvent[]
  groupedErrors: GroupedError[]
  verbose: boolean
  performanceMode: 'normal' | 'lightweight'
}

const ROW_HEIGHT = 28
const VISIBLE_PADDING = 10

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getSeverityDot(severity: string): string {
  switch (severity) {
    case 'error':
      return 'bg-red-400'
    case 'warn':
      return 'bg-yellow-400'
    default:
      return 'bg-green-400'
  }
}

function getStageBadgeColor(stage: string): string {
  const colors: Record<string, string> = {
    queue: 'bg-gray-600/50',
    config_resolve: 'bg-blue-600/50',
    clipboard: 'bg-purple-600/50',
    focus: 'bg-indigo-600/50',
    paste: 'bg-pink-600/50',
    prompt: 'bg-orange-600/50',
    script_generation: 'bg-cyan-600/50',
    script_execution: 'bg-teal-600/50',
    submit_ready: 'bg-emerald-600/50',
    click: 'bg-lime-600/50',
    complete: 'bg-green-600/50',
    error: 'bg-red-600/50'
  }
  return colors[stage] || 'bg-gray-600/50'
}

const EventRow = function EventRow({
  event,
  style
}: {
  event: DiagnosticsEvent
  style: React.CSSProperties
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 text-[11px] font-mono border-b border-white/5 hover:bg-white/5 transition-colors"
      style={{ ...style, height: ROW_HEIGHT }}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getSeverityDot(event.severity)}`} />
      <span className="text-white/30 w-16 shrink-0">{formatTimestamp(event.timestamp)}</span>
      <span
        className={`px-1 py-0.5 rounded text-[9px] shrink-0 ${getStageBadgeColor(event.pipelineStage)}`}
      >
        {event.pipelineStage}
      </span>
      <span className="text-white/50 w-14 shrink-0">{event.provider}</span>
      <span className="text-white/60 truncate flex-1">{event.message || event.type}</span>
      {event.duration !== undefined && (
        <span className="text-white/30 w-12 shrink-0 text-right">
          {formatDuration(event.duration)}
        </span>
      )}
      {event.retryCount !== undefined && event.retryCount > 0 && (
        <span className="text-yellow-400 shrink-0 text-[9px]">×{event.retryCount}</span>
      )}
      {event.timedOut && (
        <span className="text-red-400 shrink-0 text-[9px] font-semibold">T/O</span>
      )}
    </div>
  )
}

const GroupedErrorRow = function GroupedErrorRow({
  group,
  style
}: {
  group: GroupedError
  style: React.CSSProperties
}) {
  const escalatedSeverity = getEscalatedSeverity(group.count, group.severity)

  return (
    <div
      className="flex items-center gap-2 px-3 text-[11px] font-mono border-b border-red-500/10 bg-red-900/10 hover:bg-red-900/20 transition-colors"
      style={{ ...style, height: ROW_HEIGHT }}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getSeverityDot(escalatedSeverity)}`} />
      <span className="text-white/30 w-16 shrink-0">{formatTimestamp(group.lastSeen)}</span>
      <span className="px-1 py-0.5 rounded text-[9px] shrink-0 bg-red-600/50">
        {group.pipelineStage}
      </span>
      <span className="text-white/50 w-14 shrink-0">{group.provider}</span>
      <span className="text-red-300 truncate flex-1">
        {group.type} ×{group.count}
      </span>
      <span className="text-red-400 shrink-0 text-[9px]">
        {formatTimestamp(group.firstSeen)} → {formatTimestamp(group.lastSeen)}
      </span>
    </div>
  )
}

export default function EventStream({
  events,
  groupedErrors,
  verbose
}: Omit<EventStreamProps, 'performanceMode'> & { performanceMode?: 'normal' | 'lightweight' }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)

  const displayEvents = useMemo(() => {
    const reversed = [...events].reverse()
    if (!verbose) {
      return reversed.filter(
        (e) => e.severity !== 'info' || e.type === 'SEND_START' || e.type === 'SEND_SUCCESS'
      )
    }
    return reversed
  }, [events, verbose])

  const allItems = useMemo(() => {
    const items: Array<
      { kind: 'event'; data: DiagnosticsEvent } | { kind: 'group'; data: GroupedError }
    > = []

    for (const group of groupedErrors) {
      items.push({ kind: 'group', data: group })
    }
    for (const event of displayEvents) {
      items.push({ kind: 'event', data: event })
    }

    return items.sort((a, b) => {
      const timeA = a.kind === 'event' ? a.data.timestamp : a.data.lastSeen
      const timeB = b.kind === 'event' ? b.data.timestamp : b.data.lastSeen
      return timeB - timeA
    })
  }, [displayEvents, groupedErrors])

  const totalHeight = allItems.length * ROW_HEIGHT

  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_PADDING)
  const visibleEnd = Math.min(
    allItems.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_PADDING
  )

  const visibleItems = useMemo(
    () => allItems.slice(visibleStart, visibleEnd),
    [allItems, visibleStart, visibleEnd]
  )

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  useEffect(() => {
    if (allItems.length === 0) return

    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [allItems.length])

  if (allItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/30 text-xs">
        No events yet. Start an AI send to see diagnostics.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-y-auto flex-1 custom-scrollbar relative"
      style={{ height: '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => {
          const actualIndex = visibleStart + index
          const top = actualIndex * ROW_HEIGHT

          if (item.kind === 'event') {
            return (
              <EventRow
                key={`event-${item.data.id}`}
                event={item.data}
                style={{ position: 'absolute', top, left: 0, right: 0 }}
              />
            )
          }

          return (
            <GroupedErrorRow
              key={`group-${item.data.type}-${item.data.provider}-${item.data.firstSeen}`}
              group={item.data}
              style={{ position: 'absolute', top, left: 0, right: 0 }}
            />
          )
        })}
      </div>
    </div>
  )
}
