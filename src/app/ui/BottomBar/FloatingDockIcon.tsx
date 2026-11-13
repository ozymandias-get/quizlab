import { DockIcon } from '@app/components/ui/dock'
import { cn } from '@shared/lib/uiUtils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/components/primitives'

import type { CSSProperties } from 'react'
import { memo, type ReactNode, useCallback } from 'react'

import { useDockTooltipAlign } from './DockTooltipPlacement'

const DOCK_ICON_BASE = 32
/** Just over the base size: enough to read as a dock, never a jump. */
const DOCK_ICON_HOVER = 35

const ICON_CONTAINER_STYLE: CSSProperties = {
  width: '1.25rem',
  height: '1.25rem'
}

interface FloatingDockIconProps {
  title: string
  children: ReactNode
  id?: string
  onClick: () => void
  /** Toggle-style tools keep a persistent active surface. */
  isActive?: boolean
  /** Action is currently unavailable; keeps the control out of the tab order. */
  disabled?: boolean
  /** Small session signal shown at the icon's trailing corner. */
  status?: 'active' | 'generating' | 'sleeping' | 'attention'
  /** Localized spoken description of `status`; appended to the accessible name. */
  statusLabel?: string
}

const STATUS_FALLBACK_LABELS: Record<NonNullable<FloatingDockIconProps['status']>, string> = {
  active: 'Active',
  generating: 'Generating',
  sleeping: 'Sleeping',
  attention: 'Needs attention'
}

export const FloatingDockIcon = memo(function FloatingDockIcon({
  title,
  children,
  id,
  onClick,
  isActive = false,
  disabled = false,
  status,
  statusLabel
}: FloatingDockIconProps) {
  const tooltipAlign = useDockTooltipAlign()

  const spokenStatus = statusLabel ?? (status ? STATUS_FALLBACK_LABELS[status] : null)
  const accessibleLabel =
    spokenStatus && !title.includes(spokenStatus) ? `${title}, ${spokenStatus}` : title

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    },
    [disabled, onClick]
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DockIcon
          id={id}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={accessibleLabel}
          aria-disabled={disabled || undefined}
          aria-busy={status === 'generating' || undefined}
          aria-current={status === 'active' ? 'true' : undefined}
          aria-pressed={isActive || undefined}
          onClick={disabled ? undefined : onClick}
          onKeyDown={handleKeyDown}
          size={DOCK_ICON_BASE}
          magnification={DOCK_ICON_HOVER}
          distance={90}
          className={cn(
            'group focus-visible:ring-ring/70 motion-normal relative shrink-0 rounded-lg ring-1 transition-colors focus-visible:ring-2 focus-visible:outline-none',
            disabled
              ? 'cursor-not-allowed text-zinc-500 opacity-50 ring-transparent'
              : isActive
                ? 'bg-white/10 text-zinc-100 ring-white/20 hover:bg-white/15'
                : 'text-zinc-400 ring-transparent hover:bg-white/5 hover:text-zinc-200 hover:ring-white/10'
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center rounded-md transition-colors',
              isActive ? 'bg-white/[0.04] text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
            )}
            style={ICON_CONTAINER_STYLE}
          >
            {children}
          </div>
          {status && (
            <span
              aria-hidden
              data-dock-status={status}
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-zinc-900',
                status === 'generating' && 'animate-pulse bg-amber-400',
                status === 'attention' && 'animate-pulse bg-amber-400',
                status === 'active' && 'animate-pulse bg-emerald-400',
                status === 'sleeping' && 'bg-zinc-500'
              )}
            />
          )}
        </DockIcon>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={12} align={tooltipAlign}>
        {title}
      </TooltipContent>
    </Tooltip>
  )
})
