import { cn } from '@shared/lib/uiUtils'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-tooltip animate-fade-in border-border bg-popover text-popover-foreground shadow-ambient-md rounded-md border px-2.5 py-1 text-xs whitespace-nowrap',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

function WithTooltip({ label, children }: { label?: string; children: React.ReactElement }) {
  if (!label) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, WithTooltip }
