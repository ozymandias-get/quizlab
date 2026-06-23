import { APP_CONSTANTS } from '@shared/constants/appConstants'

import { describe, expect, it } from 'vitest'

describe('APP_CONSTANTS', () => {
  it('should have GITHUB_RELEASES_URL as a valid GitHub releases URL', () => {
    expect(APP_CONSTANTS.GITHUB_RELEASES_URL).toMatch(
      /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases/
    )
  })

  it('should have GITHUB_REPO_URL as a valid GitHub repo URL', () => {
    expect(APP_CONSTANTS.GITHUB_REPO_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/)
  })

  it('should have SCREENSHOT_TYPES with FULL and CROP', () => {
    expect(APP_CONSTANTS.SCREENSHOT_TYPES.FULL).toBe('full-page')
    expect(APP_CONSTANTS.SCREENSHOT_TYPES.CROP).toBe('crop')
  })

  it('should have TOUR_TARGETS with all required targets', () => {
    expect(APP_CONSTANTS.TOUR_TARGETS).toHaveProperty('HUB_BTN')
    expect(APP_CONSTANTS.TOUR_TARGETS).toHaveProperty('TOOLS_PANEL')
    expect(APP_CONSTANTS.TOUR_TARGETS).toHaveProperty('MODELS_LIST')
    expect(APP_CONSTANTS.TOUR_TARGETS).toHaveProperty('TOOL_PICKER')
    expect(APP_CONSTANTS.TOUR_TARGETS).toHaveProperty('TOOL_SWAP')
    expect(APP_CONSTANTS.TOUR_TARGETS).toHaveProperty('TOOL_SETTINGS')
  })

  it('should have all TOUR_TARGETS values as strings with tour-target- prefix', () => {
    Object.values(APP_CONSTANTS.TOUR_TARGETS).forEach((value) => {
      expect(value).toMatch(/^tour-target-/)
    })
  })
})
