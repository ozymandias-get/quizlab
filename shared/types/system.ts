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
export type ScreenshotType = 'full-page' | 'crop' | string
