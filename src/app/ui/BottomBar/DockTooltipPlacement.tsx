import { createContext, useContext } from 'react'

/**
 * Horizontal alignment shared by every dock tooltip.
 *
 * The dock is a 48px column wedged between two panels, so a tooltip wider than
 * the column (most labels are) always spills into one of its neighbours. It has
 * to spill towards the PDF panel: the AI panel is a main-process
 * `WebContentsView`, and a native view composites *above* the renderer DOM, so
 * any part of the bubble that lands on it is simply not painted — the label
 * used to disappear behind the website it was describing.
 *
 * `end` therefore pins the bubble's trailing edge to the icon's, leaving the
 * AI side of the dock clear. A swapped layout mirrors the dock, so the provider
 * flips the value.
 */
export type DockTooltipAlign = 'start' | 'center' | 'end'

const DockTooltipAlignContext = createContext<DockTooltipAlign>('center')

export const DockTooltipAlignProvider = DockTooltipAlignContext.Provider

/** Defaults to `center` so an icon rendered outside a provider keeps working. */
export const useDockTooltipAlign = (): DockTooltipAlign => useContext(DockTooltipAlignContext)
