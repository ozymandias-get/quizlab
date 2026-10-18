export const EXTENSION_SOURCE_DIR = 'extensions/quizlab-session-extension'

/** Native messaging host name + manifest file base name (Chrome registry key suffix). */
export const NATIVE_HOST_MANIFEST_NAME = 'com.quizlab.reader'

export const BRIDGE_PORT = (() => {
  const raw = process.env.QUIZLAB_EXTENSION_BRIDGE_PORT?.trim()
  if (raw) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed > 1024 && parsed < 65535) return parsed
  }
  return 51999
})()

export const MAX_COOKIE_BODY_SIZE = 1024 * 512 // 512 KB

// isAllowedOrigin was removed — HMAC signing provides auth regardless of origin.
