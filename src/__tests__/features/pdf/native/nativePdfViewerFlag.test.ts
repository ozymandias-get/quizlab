/**
 * The native viewer's opt-in parsing.
 *
 * The point of these tests is the negative space: an unset flag and every
 * near-miss spelling of "on" must resolve to the legacy viewer, because the flag
 * is the only thing standing between a stray deployment variable and swapping the
 * shipped PDF renderer for an experimental one.
 */
import {
  isNativePdfViewerEnabled,
  NATIVE_PDF_VIEWER_ENV_KEY,
  readNativePdfViewerFlag
} from '@features/pdf/native'

import { afterEach, describe, expect, it, vi } from 'vitest'

describe('readNativePdfViewerFlag', () => {
  it('enables the native viewer only for the exact string "true"', () => {
    expect(readNativePdfViewerFlag('true')).toBe(true)
    // Surrounding whitespace is a shell-pasting artefact, not a different answer.
    expect(readNativePdfViewerFlag('  true  ')).toBe(true)
    expect(readNativePdfViewerFlag('TRUE')).toBe(true)
  })

  it('treats every other truthy-looking string as off', () => {
    for (const raw of ['false', '0', '1', 'yes', 'on', 'enabled', 'truthy', 'truetrue']) {
      expect(readNativePdfViewerFlag(raw), raw).toBe(false)
    }
  })

  it('treats a non-string environment value as off', () => {
    // Vite exposes env values as strings, so anything else means the variable is
    // absent or was injected by something other than the env.
    expect(readNativePdfViewerFlag(undefined)).toBe(false)
    expect(readNativePdfViewerFlag(null)).toBe(false)
    expect(readNativePdfViewerFlag(true)).toBe(false)
    expect(readNativePdfViewerFlag(1)).toBe(false)
  })
})

describe('isNativePdfViewerEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to the legacy viewer when the variable is absent', () => {
    expect(isNativePdfViewerEnabled()).toBe(false)
  })

  it('reads the variable at call time rather than at module load', () => {
    vi.stubEnv(NATIVE_PDF_VIEWER_ENV_KEY, 'true')
    expect(isNativePdfViewerEnabled()).toBe(true)

    vi.stubEnv(NATIVE_PDF_VIEWER_ENV_KEY, 'false')
    expect(isNativePdfViewerEnabled()).toBe(false)
  })

  it('is off for the explicit string "false"', () => {
    vi.stubEnv(NATIVE_PDF_VIEWER_ENV_KEY, 'false')
    expect(isNativePdfViewerEnabled()).toBe(false)
  })
})
