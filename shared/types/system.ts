/**
 * System & Update Types
 */

export type UpdateCheckResult = {
  available: boolean
  version?: string
  releaseName?: string
  releaseNotes?: string
  cached?: boolean
  error?: string
}

export const SCREENSHOT_TYPES = {
  FULL: 'full-page',
  CROP: 'crop'
} as const

export type ScreenshotType = (typeof SCREENSHOT_TYPES)[keyof typeof SCREENSHOT_TYPES]
