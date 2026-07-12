import { cn } from '@shared/lib/uiUtils'

import { memo } from 'react'

import { formatBytes } from './storageUtils'

export const ProgressBar = memo(function ProgressBar({
  value,
  max,
  color
}: {
  value: number
  max: number
  color: string
}) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100)
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={cn('h-full rounded-full transition-transform duration-500', color)}
        style={{ transform: `scaleX(${pct / 100})`, transformOrigin: 'left' }}
      />
    </div>
  )
})

export const RootCacheRow = memo(function RootCacheRow({
  label,
  size
}: {
  label: string
  size: number
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ql-12 text-foreground/85">{label}</span>
      <span className="text-ql-12 text-foreground/70 font-mono">{formatBytes(size)}</span>
    </div>
  )
})

export const PartitionRow = memo(function PartitionRow({
  partitionKey,
  label,
  size
}: {
  partitionKey: string
  label: string
  size: number
}) {
  return (
    <div className="flex items-baseline justify-between px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-2 w-2 shrink-0 rounded-full bg-white/40" />
        <div className="min-w-0">
          <span className="text-ql-12 text-foreground/90 block truncate">{label}</span>
          <span className="text-ql-11 text-foreground/65 block truncate font-mono">
            {partitionKey}
          </span>
        </div>
      </div>
      <span className="text-ql-12 text-foreground/70 ml-4 shrink-0 font-mono">
        {formatBytes(size)}
      </span>
    </div>
  )
})
