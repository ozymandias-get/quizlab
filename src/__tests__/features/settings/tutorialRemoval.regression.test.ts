import { SETTINGS_TAB_COMPONENTS } from '@features/settings/ui/modal/settingsTabComponents'
import { SETTINGS_TABS, toSettingsTabId } from '@features/settings/ui/modal/settingsTabDefinitions'

import { describe, expect, it } from 'vitest'

/**
 * The usage-guide / guided-tour feature was deleted along with its settings
 * tab and its i18n bundles. These two tests are what remains of that removal
 * audit, and both are live invariants rather than tombstones:
 *
 * 1. every tab the sidebar offers must have a component registered to render
 *    it — a mismatch renders an empty modal panel with no error;
 * 2. an unrecognised tab id (including a stale `'tutorial'` preference saved by
 *    an older build) must degrade to "no tab" rather than throwing.
 */
describe('settings tab registry', () => {
  it('maps every registered tab to a component', () => {
    for (const tab of SETTINGS_TABS) {
      expect(SETTINGS_TAB_COMPONENTS[tab.id], `missing component for tab "${tab.id}"`).toBeDefined()
    }
  })

  it.each([
    ['the removed tutorial tab', 'tutorial'],
    ['an unknown tab id', 'not-a-real-tab'],
    ['an empty string', ''],
    ['undefined', undefined]
  ])('treats %s as unknown', (_label, value) => {
    expect(toSettingsTabId(value)).toBeNull()
  })

  it('resolves a known tab id', () => {
    expect(toSettingsTabId('prompts')).toBe('prompts')
  })
})
