import { APP_CONSTANTS } from '@shared/constants/appConstants'

import { describe, expect, it } from 'vitest'

describe('APP_CONSTANTS', () => {
  it.each([
    ['GITHUB_RELEASES_URL', /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases/],
    ['GITHUB_REPO_URL', /^https:\/\/github\.com\/[^/]+\/[^/]+$/]
  ])('should have %s as a valid GitHub URL', (key, pattern) => {
    expect(APP_CONSTANTS[key as 'GITHUB_REPO_URL']).toMatch(pattern)
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
