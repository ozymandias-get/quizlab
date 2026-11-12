import { useSyncExternalStore } from 'react'

/**
 * Whether the pointer is currently over the bottom dock.
 *
 * Kept outside React on purpose: hovering the dock used to set App state, which
 * re-rendered the whole workspace (including the PDF viewer) twice per crossing.
 * The two consumers that actually care read it without joining that render:
 *
 * - PDF text selection gates its handlers at event time.
 * - The Drive panel subscribes to paint its transparent interaction shield.
 */
let hovered = false
const listeners = new Set<() => void>()

export function setDockHovered(next: boolean): void {
  if (hovered === next) return
  hovered = next
  for (const listener of listeners) listener()
}

export function getDockHovered(): boolean {
  return hovered
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Subscribe a component to dock hover (only the Drive shield needs this). */
export function useDockHovered(): boolean {
  return useSyncExternalStore(subscribe, getDockHovered, () => false)
}
