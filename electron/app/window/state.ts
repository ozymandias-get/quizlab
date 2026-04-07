import path from 'path'
import { BrowserWindow, app, screen } from 'electron'
import { APP_CONFIG } from '../constants'
import { ConfigManager } from '../../core/ConfigManager'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

const windowStateFile = path.join(app.getPath('userData'), 'window-state.json')
const windowStateManager = new ConfigManager<WindowState>(windowStateFile)

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function clampWindowStateToDisplay(windowState: WindowState) {
  if (windowState.x === undefined || windowState.y === undefined) return

  const display = screen.getDisplayMatching(windowState as Electron.Rectangle)
  if (!display) {
    windowState.x = undefined
    windowState.y = undefined
    return
  }

  const { workArea } = display

  if (windowState.width > workArea.width) windowState.width = workArea.width
  if (windowState.height > workArea.height) windowState.height = workArea.height

  if (windowState.x + windowState.width > workArea.x + workArea.width) {
    windowState.x = workArea.x + workArea.width - windowState.width
  }
  if (windowState.x < workArea.x) {
    windowState.x = workArea.x
  }

  if (windowState.y + windowState.height > workArea.y + workArea.height) {
    windowState.y = workArea.y + workArea.height - windowState.height
  }
  if (windowState.y < workArea.y) {
    windowState.y = workArea.y
  }
}

function getDefaultWindowState(): WindowState {
  return {
    width: APP_CONFIG.WINDOW.DEFAULT_WIDTH,
    height: APP_CONFIG.WINDOW.DEFAULT_HEIGHT,
    isMaximized: false
  }
}

export async function loadWindowState(): Promise<WindowState> {
  const stored = await windowStateManager.read()
  const defaults = getDefaultWindowState()
  const merged = { ...defaults, ...stored }

  return {
    width: toFiniteNumber(merged.width, defaults.width),
    height: toFiniteNumber(merged.height, defaults.height),
    x: toOptionalFiniteNumber(merged.x),
    y: toOptionalFiniteNumber(merged.y),
    isMaximized: typeof merged.isMaximized === 'boolean' ? merged.isMaximized : defaults.isMaximized
  }
}

export async function saveWindowState(window: BrowserWindow | null) {
  try {
    if (!window || window.isDestroyed()) return

    const isMaximized = window.isMaximized()
    const bounds =
      isMaximized && window.getNormalBounds ? window.getNormalBounds() : window.getBounds()

    await windowStateManager.write({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized
    })
  } catch (error) {
    console.warn('[WindowState] Save error:', error)
  }
}
