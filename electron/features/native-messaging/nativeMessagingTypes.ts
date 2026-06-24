export const EXTENSION_SOURCE_DIR = 'extensions/quizlab-session-extension'

export const BRIDGE_PORT = (() => {
  const raw = process.env.QUIZLAB_EXTENSION_BRIDGE_PORT?.trim()
  if (raw) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed > 1024 && parsed < 65535) return parsed
  }
  return 51999
})()

export const CRITICAL_COOKIE_NAMES = new Set([
  'SID',
  '__Secure-1PSID',
  '__Secure-3PSID',
  '__Secure-1PSIDTS',
  '__Secure-3PSIDTS',
  '__Secure-1PSIDCC',
  '__Secure-3PSIDCC'
])

export const HMAC_HEADER = 'x-hmac-signature'
export const BRIDGE_SECRET_HEADER = 'x-bridge-secret'

export const MAX_COOKIE_BODY_SIZE = 1024 * 512 // 512 KB

const QUIZLAB_EXTENSION_ID = 'l25qwee4dhfetd2yusry4mngn7ktcdwk'
const ALLOWED_EXTENSION_ORIGINS = [`chrome-extension://${QUIZLAB_EXTENSION_ID}`]

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  return ALLOWED_EXTENSION_ORIGINS.some((allowed) => origin.startsWith(allowed))
}
