import { cn } from '@shared/lib/uiUtils'

import { useId } from 'react'

interface DotPatternProps extends React.SVGProps<SVGSVGElement> {
  width?: number
  height?: number
  x?: number
  y?: number
  cx?: number
  cy?: number
  cr?: number
  className?: string
  glow?: boolean
}

/**
 * Lightweight dot-pattern background.
 *
 * A single SVG `<pattern>` filled once by one `<rect>` replaces the previous
 * one-node-per-dot approach: hundreds of animated motion circles for a purely
 * decorative backdrop are expensive, and only the glow variant needs motion.
 */
export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  glow = false,
  ...props
}: DotPatternProps) {
  const id = useId()
  const patternId = `dot-pattern-${id.replaceAll(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full text-zinc-400/80',
        className
      )}
      {...props}
    >
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <circle cx={cx} cy={cy} r={cr} fill="currentColor" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#${patternId})`}
        className={glow ? 'motion-safe:animate-pulse' : undefined}
      />
    </svg>
  )
}
