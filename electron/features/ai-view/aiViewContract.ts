import type {
  AiContentInputEvent,
  AiViewBounds,
  AiViewHostRequest,
  AiViewHostSyncRequest,
  AiViewSource
} from '../../../shared/types/aiView.js'

/**
 * Runtime validation for everything the renderer sends across the AI view IPC
 * surface.
 *
 * The renderer is treated as untrusted input: ids, tokens, rectangles, scripts
 * and input events are all re-derived or range-checked here so that neither the
 * manager nor Electron itself ever receives a malformed value.
 */

const MAX_ID_LENGTH = 128
const MAX_HOST_TOKEN_LENGTH = 128
const MAX_TEXT_LENGTH = 512 * 1024
const MAX_SCRIPT_LENGTH = 512 * 1024
const MAX_URL_LENGTH = 4096
const MAX_KEY_CODE_LENGTH = 64
const MAX_MODIFIERS = 8

export const MAX_VIEW_RECT_EDGE = 32_768
export const MAX_VIEW_BORDER_RADIUS = 512

const INPUT_EVENT_TYPES = new Set<AiContentInputEvent['type']>(['keyDown', 'keyUp', 'char'])

export function isValidViewId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

export function isValidHostToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_HOST_TOKEN_LENGTH
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseViewId(value: unknown): string | null {
  return isValidViewId(value) ? value : null
}

export function parseTabRequest(value: unknown): { viewId: string } | null {
  if (!isPlainRecord(value)) return null
  const viewId = parseViewId(value.viewId)
  return viewId ? { viewId } : null
}

export function parseHostRequest(value: unknown): AiViewHostRequest | null {
  if (!isPlainRecord(value)) return null
  const viewId = parseViewId(value.viewId)
  const hostToken = parseHostToken(value.hostToken)
  return viewId && hostToken ? { viewId, hostToken } : null
}

export function parseHostSyncRequest(value: unknown): AiViewHostSyncRequest | null {
  const host = parseHostRequest(value)
  if (!host) return null
  const bounds = parseBounds(isPlainRecord(value) ? value.bounds : null)
  const visible = isPlainRecord(value) ? value.visible : null
  if (!bounds || (visible !== true && visible !== false)) return null
  return { ...host, bounds, visible }
}

function parseHostToken(value: unknown): string | null {
  return isValidHostToken(value) ? value : null
}

function toFiniteInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value)
}

/** Like `toFiniteInteger` but keeps sub-pixel radii, which CSS can produce. */
function toNonNegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, value)
}

/**
 * Normalises a host rectangle into the integer, non-negative shape
 * `View.setBounds` expects. `null` means "not a rectangle at all"; a rectangle
 * whose width or height collapses to zero is legitimate (hidden host) and is
 * returned as-is so the caller can decide to hide the view.
 *
 * `borderRadius` travels with the rectangle on purpose: the corner radius has to
 * be applied in the same step as the bounds, or a resized view would briefly be
 * clipped to the previous panel's radius.
 */
export function parseBounds(value: unknown): AiViewBounds | null {
  if (!isPlainRecord(value)) return null
  const x = toFiniteInteger(value.x)
  const y = toFiniteInteger(value.y)
  const width = toFiniteInteger(value.width)
  const height = toFiniteInteger(value.height)
  if (x === null || y === null || width === null || height === null) return null

  return {
    x: clamp(x, 0, MAX_VIEW_RECT_EDGE),
    y: clamp(y, 0, MAX_VIEW_RECT_EDGE),
    width: clamp(width, 0, MAX_VIEW_RECT_EDGE),
    height: clamp(height, 0, MAX_VIEW_RECT_EDGE),
    borderRadius: clamp(
      value.borderRadius === undefined ? 0 : toNonNegativeNumber(value.borderRadius),
      0,
      MAX_VIEW_BORDER_RADIUS
    )
  }
}

export function isUsableBounds(bounds: AiViewBounds | null): bounds is AiViewBounds {
  return bounds !== null && bounds.width > 0 && bounds.height > 0
}

export function boundsEqual(a: AiViewBounds | null, b: AiViewBounds | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    (a.borderRadius ?? 0) === (b.borderRadius ?? 0)
  )
}

export function parseScript(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.length === 0 || value.length > MAX_SCRIPT_LENGTH) return null
  return value
}

export function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.length > MAX_TEXT_LENGTH) return null
  return value
}

export function parseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.length === 0 || value.length > MAX_URL_LENGTH) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function parseDelta(value: unknown): -1 | 1 | null {
  return value === -1 || value === 1 ? value : null
}

export function parseInputEvent(value: unknown): AiContentInputEvent | null {
  if (!isPlainRecord(value)) return null
  const type = value.type
  if (typeof type !== 'string' || !INPUT_EVENT_TYPES.has(type as AiContentInputEvent['type'])) {
    return null
  }
  const keyCode = value.keyCode
  if (typeof keyCode !== 'string' || keyCode.length === 0 || keyCode.length > MAX_KEY_CODE_LENGTH) {
    return null
  }

  const rawModifiers = value.modifiers
  let modifiers: string[] | undefined
  if (Array.isArray(rawModifiers)) {
    const accepted = rawModifiers
      .filter((modifier): modifier is string => typeof modifier === 'string')
      .slice(0, MAX_MODIFIERS)
    modifiers = accepted
  }

  return {
    type: type as AiContentInputEvent['type'],
    keyCode,
    ...(modifiers ? { modifiers } : {})
  }
}

/**
 * The renderer may only ask for a target the main process already knows about.
 * Anything else — a raw partition, a raw origin, an unknown key — is rejected
 * before it reaches the WebContentsView constructor.
 */
export function parseSource(value: unknown): AiViewSource | null {
  if (!isPlainRecord(value)) return null
  const kind = value.kind
  if (kind === 'ai-platform') {
    const modelId = parseViewId(value.modelId)
    return modelId ? { kind: 'ai-platform', modelId } : null
  }
  if (kind === 'google-web-app') {
    const appId = parseViewId(value.appId)
    return appId ? { kind: 'google-web-app', appId } : null
  }
  return null
}

export function parseRestoredUrl(value: unknown): string | null {
  return parseUrl(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
