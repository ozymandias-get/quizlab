export const EXTENSION_SOURCE_DIR = 'extensions/quizlab-session-extension'

/**
 * The ports the bridge may listen on.
 *
 * The extension scans exactly this range (`PORT_START`-`PORT_END` in its
 * background worker). A bridge that moved past the end would be invisible to
 * the extension, so the fallback in `startServer` must stop at the end
 * instead of walking towards the 65535 limit.
 */
export const BRIDGE_PORT_RANGE_START = 51999
export const BRIDGE_PORT_RANGE_END = 52009

export const BRIDGE_PORT = (() => {
  const raw = process.env.QUIZLAB_EXTENSION_BRIDGE_PORT?.trim()
  if (raw) {
    const parsed = Number(raw)
    if (
      Number.isFinite(parsed) &&
      parsed >= BRIDGE_PORT_RANGE_START &&
      parsed <= BRIDGE_PORT_RANGE_END
    ) {
      return parsed
    }
  }
  return BRIDGE_PORT_RANGE_START
})()

export const MAX_COOKIE_BODY_SIZE = 1024 * 512 // 512 KB

// isAllowedOrigin was removed — HMAC signing provides auth regardless of origin.
