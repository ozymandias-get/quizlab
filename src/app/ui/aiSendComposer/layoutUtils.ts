import { reportSuppressedError } from '@shared/lib/logger'

import type { DockLayout, ResizeDirection } from './types'

export const STORAGE_KEY = 'aiSendDockLayout'
export const DEFAULT_LAYOUT: DockLayout = {
  x: 28,
  y: 0,
  width: 320,
  height: 340
}
export const MIN_WIDTH = 280
export const MAX_WIDTH = 600
export const MIN_HEIGHT = 140
export const MAX_HEIGHT = 700
export const BOTTOM_OFFSET = 92
export const VIEWPORT_PADDING = 8
export const EDGE_THICKNESS = 6

export const COMPACT_HEIGHT = 56
export const HEADER_RESERVED_HEIGHT = 200
export const MIN_BODY_HEIGHT = 80

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

export function clampLayout(layout: DockLayout): DockLayout {
  if (typeof window === 'undefined') return layout

  const maxW = Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2)
  const maxH = Math.min(MAX_HEIGHT, window.innerHeight - VIEWPORT_PADDING * 2)

  return {
    x: clamp(
      layout.x,
      VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, window.innerWidth - layout.width - VIEWPORT_PADDING)
    ),
    y: clamp(
      layout.y,
      VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, window.innerHeight - layout.height - VIEWPORT_PADDING)
    ),
    width: clamp(layout.width, MIN_WIDTH, maxW),
    height: clamp(layout.height, MIN_HEIGHT, maxH)
  }
}

export function createDefaultLayout(): DockLayout {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  return clampLayout({
    ...DEFAULT_LAYOUT,
    y: window.innerHeight - DEFAULT_LAYOUT.height - BOTTOM_OFFSET
  })
}

export function loadStoredLayout(): DockLayout {
  if (typeof window === 'undefined') return createDefaultLayout()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DockLayout
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        typeof parsed.width === 'number' &&
        typeof parsed.height === 'number'
      ) {
        return clampLayout(parsed)
      }
    }
  } catch (err) {
    reportSuppressedError('aiSendDockLayout.load', { cause: err })
  }
  return createDefaultLayout()
}

export function saveLayoutToStorage(layout: DockLayout) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch (err) {
    reportSuppressedError('aiSendDockLayout.save', { cause: err })
  }
}

export interface DragState {
  offsetX: number
  offsetY: number
}

export interface ResizeState {
  startX: number
  startY: number
  startLayout: DockLayout
  direction: ResizeDirection
}
