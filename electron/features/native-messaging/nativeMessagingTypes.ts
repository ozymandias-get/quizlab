import type { QuizlabEnvironment } from '../../../shared/constants/extensionRelease.js'

/**
 * The ports the bridge may listen on, per environment.
 *
 * The extension scans exactly the range of its own build (`PORT_START`/`PORT_END`
 * in its background worker). A bridge that moved past the end of its range would
 * be invisible to the extension, so the fallback in `startServer` must stop at
 * the end instead of walking towards the 65535 limit.
 *
 * The ranges are disjoint on purpose: a port that is taken is retried inside the
 * range of the same environment only. An environment never falls back into the
 * other one's range, so two running apps can never answer each other's
 * extension.
 */
export interface BridgePortRange {
  start: number
  end: number
}

const BRIDGE_PORT_RANGES: Readonly<Record<QuizlabEnvironment, BridgePortRange>> = {
  prod: { start: 51999, end: 52009 },
  dev: { start: 52010, end: 52020 }
}

/** The ports one environment may use. */
export function resolveBridgePortRange(environment: QuizlabEnvironment): BridgePortRange {
  return BRIDGE_PORT_RANGES[environment]
}

/**
 * The first port a bridge tries.
 *
 * `QUIZLAB_EXTENSION_BRIDGE_PORT` still overrides the port for local debugging,
 * but only inside the range of the running environment. A value from the other
 * environment's range is ignored instead of moving the bridge out of its range.
 */
export function resolveBridgePort(
  environment: QuizlabEnvironment,
  raw: string | undefined = process.env.QUIZLAB_EXTENSION_BRIDGE_PORT
): number {
  const range = resolveBridgePortRange(environment)
  const value = raw?.trim()
  if (value) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= range.start && parsed <= range.end) {
      return parsed
    }
  }
  return range.start
}

/** The port the release bridge starts on. */
export const BRIDGE_PORT = resolveBridgePort('prod')

/** The largest cookie packet the bridge imports. */
export const MAX_COOKIE_BODY_SIZE = 1024 * 512 // 512 KB

/**
 * The most bytes the bridge ever reads from a cookie POST.
 *
 * A packet is imported only up to `MAX_COOKIE_BODY_SIZE`. The extra room lets a
 * packet that is only a little too large be read to its end, so its signature
 * can still be verified and its site recorded as a failed import.
 *
 * Past this point the body is no longer read, hashed or kept: the request is
 * answered with 413 and its connection is closed. Without that hard stop an
 * upload that never fits would be hashed byte by byte for as long as it runs,
 * which costs CPU without ever changing the answer.
 */
export const MAX_COOKIE_READ_SIZE = MAX_COOKIE_BODY_SIZE + 64 * 1024
