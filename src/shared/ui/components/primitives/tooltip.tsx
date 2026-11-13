import { cn } from '@shared/lib/uiUtils'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

/**
 * Radix closes a tooltip from the trigger's own `pointerleave`. That leaves a
 * dead tooltip on screen whenever the DOM never gets to deliver that event:
 * the trigger is replaced/unmounted while hovered, a native `WebContentsView`
 * swallows the pointer, the window loses focus, or the panel under the pointer
 * is re-laid out. The result is a tooltip frozen at its last position.
 *
 * To make dismissal independent of the trigger element, every open tooltip
 * registers a closer here and one shared set of document listeners closes all
 * of them on the next real interaction (or as soon as the pointer is clearly
 * outside both the trigger and the tooltip bubble).
 */
const openTooltipClosers = new Set<() => void>()
let isGlobalDismissAttached = false

function closeAllTooltips(): void {
  for (const close of openTooltipClosers) close()
}

/**
 * An open tooltip owns two nodes: its trigger and its portalled content
 * (hovering the bubble keeps it open). Radix marks both with a non-`closed`
 * `data-state` — `"instant-open"` or `"delayed-open"` depending on the
 * provider delay — so containment is all the check needs.
 */
const OPEN_TOOLTIP_SELECTOR =
  '[data-slot="tooltip-trigger"][data-state="instant-open"], ' +
  '[data-slot="tooltip-trigger"][data-state="delayed-open"], ' +
  '[data-slot="tooltip-content"][data-state="instant-open"], ' +
  '[data-slot="tooltip-content"][data-state="delayed-open"]'

function isInsideOpenTooltip(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(OPEN_TOOLTIP_SELECTOR) !== null
}

const handlePointerMove = (event: PointerEvent): void => {
  if (!isInsideOpenTooltip(event.target)) closeAllTooltips()
}

const handlePointerDown = (): void => closeAllTooltips()

const handleScroll = (): void => closeAllTooltips()

const handleDragStart = (): void => closeAllTooltips()

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') closeAllTooltips()
}

const handleWindowBlur = (): void => closeAllTooltips()

const handleVisibilityChange = (): void => {
  if (document.visibilityState === 'hidden') closeAllTooltips()
}

function attachGlobalDismiss(): void {
  if (isGlobalDismissAttached) return
  isGlobalDismissAttached = true
  document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: true })
  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('scroll', handleScroll, true)
  document.addEventListener('dragstart', handleDragStart, true)
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('blur', handleWindowBlur)
}

function detachGlobalDismiss(): void {
  if (!isGlobalDismissAttached) return
  isGlobalDismissAttached = false
  document.removeEventListener('pointermove', handlePointerMove, true)
  document.removeEventListener('pointerdown', handlePointerDown, true)
  document.removeEventListener('scroll', handleScroll, true)
  document.removeEventListener('dragstart', handleDragStart, true)
  document.removeEventListener('keydown', handleKeyDown, true)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('blur', handleWindowBlur)
}

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

/**
 * Controlled wrapper around the Radix root. Radix still owns the hover/focus
 * timing and reports every change through `onOpenChange`; owning `open` here
 * only lets the shared listeners force it shut.
 */
function Tooltip({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const isControlled = openProp !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
  const open = isControlled ? openProp : uncontrolledOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )

  React.useEffect(() => {
    if (!open) return

    const close = () => setOpen(false)
    openTooltipClosers.add(close)
    attachGlobalDismiss()

    return () => {
      openTooltipClosers.delete(close)
      if (openTooltipClosers.size === 0) detachGlobalDismiss()
    }
  }, [open, setOpen])

  return <TooltipPrimitive.Root data-slot="tooltip" {...props} open={open} onOpenChange={setOpen} />
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
          'z-tooltip animate-fade-in rounded-md border border-white/15 bg-zinc-900/95 px-2.5 py-1 text-xs whitespace-nowrap text-zinc-200 shadow-lg backdrop-blur-xl',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

function WithTooltip({
  label,
  children,
  contentClassName
}: {
  label?: string
  children: React.ReactElement
  contentClassName?: string
}) {
  if (!label) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={contentClassName}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, WithTooltip }
