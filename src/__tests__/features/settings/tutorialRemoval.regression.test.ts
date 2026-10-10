/**
 * Regression coverage for the removal of the usage-guide / guided-tour system.
 *
 * The tutorial feature (`src/features/tutorial`), its settings tab, its i18n
 * bundles and its auto-start effect were deleted. These tests pin the removal:
 * settings must not list a Usage Guide tab, a stale `tutorial` tab preference
 * must degrade to "no tab selected" instead of breaking the modal, tutorial
 * i18n keys must be gone from both languages while shared keys keep working,
 * and the deleted feature barrel must no longer resolve.
 *
 * Preserved behaviour (language onboarding dialog, Magic Picker element
 * picking, PDF viewing, AI send) is covered by its own suites:
 * `LanguageSelectionDialog`, `SelectorsTab` (re-pick), `viewerShellWiring`
 * and `AppToolContext/queue-behavior`.
 */
import { SETTINGS_TAB_COMPONENTS } from '@features/settings/ui/modal/settingsTabComponents'
import { SETTINGS_TABS, toSettingsTabId } from '@features/settings/ui/modal/settingsTabDefinitions'
import { useSettingsModalState } from '@features/settings/ui/modal/useSettingsModalState'
import '@shared/i18n/i18next'

import { act, renderHook } from '@testing-library/react'
import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  await i18next.changeLanguage('en')
})

describe('usage-guide removal', () => {
  it('registers no tutorial tab in settings', () => {
    expect(SETTINGS_TABS.some((tab) => (tab.id as string) === 'tutorial')).toBe(false)
    expect('tutorial' in SETTINGS_TAB_COMPONENTS).toBe(false)
  })

  it('maps every registered tab to a component', () => {
    for (const tab of SETTINGS_TABS) {
      expect(SETTINGS_TAB_COMPONENTS[tab.id], `missing component for tab "${tab.id}"`).toBeDefined()
    }
  })

  it('treats a stale tutorial tab preference as unknown', () => {
    expect(toSettingsTabId('tutorial')).toBeNull()
    expect(toSettingsTabId(undefined)).toBeNull()
  })

  it('opens with no active tab when the saved tab was the removed tutorial', () => {
    const { result } = renderHook(() =>
      useSettingsModalState({ isOpen: true, initialTab: 'tutorial' })
    )
    expect(result.current.activeTab).toBeNull()
    expect(result.current.activeTabMeta).toBeNull()
  })

  it('ignores switching to the removed tutorial tab', () => {
    const { result } = renderHook(() =>
      useSettingsModalState({ isOpen: true, initialTab: 'prompts' })
    )
    expect(result.current.activeTab).toBe('prompts')

    act(() => {
      result.current.setActiveTab('tutorial')
    })
    expect(result.current.activeTab).toBe('prompts')
  })

  it('ships no tutorial keys in either language bundle', () => {
    for (const lng of ['en', 'tr'] as const) {
      const bundle = i18next.getResourceBundle(lng, 'translation') as Record<string, unknown>
      const keys = Object.keys(bundle)
      expect(keys.filter((k) => k.startsWith('tutorial_'))).toEqual([])
      expect(keys.filter((k) => k.startsWith('tut_'))).toEqual([])
      expect(keys.filter((k) => k.startsWith('usage_assistant_'))).toEqual([])
      expect(keys.filter((k) => k.startsWith('ua_step'))).toEqual([])
    }
  })

  it('keeps shared onboarding and settings keys working in both languages', () => {
    for (const lng of ['en', 'tr'] as const) {
      const bundle = i18next.getResourceBundle(lng, 'translation') as Record<string, unknown>
      expect(typeof bundle['onboarding_language_title']).toBe('string')
      expect(typeof bundle['selectors_description_simple']).toBe('string')
    }
  })

  it('no longer resolves the deleted tutorial barrel', async () => {
    // Built at runtime so neither Vite's import analysis nor madge sees a
    // static specifier: both would otherwise fail the file for an import
    // that is intentionally unresolvable.
    const specifier = `@features/${'tutorial'}`
    await expect(import(/* @vite-ignore */ specifier)).rejects.toThrow()
  })
})
