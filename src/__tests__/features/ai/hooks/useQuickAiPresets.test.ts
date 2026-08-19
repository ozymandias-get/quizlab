import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useQuickAiPresets } from '../../../../features/ai/hooks/useQuickAiPresets'

describe('useQuickAiPresets', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides default primary and secondary presets', () => {
    const { result } = renderHook(() => useQuickAiPresets())

    expect(result.current.presets).toHaveLength(8)
    expect(result.current.primaryPresets).toHaveLength(3)
    expect(result.current.secondaryPresets).toHaveLength(5)
    expect(result.current.hasAnyCustomized).toBe(false)

    const explain = result.current.presets.find((p) => p.key === 'explain')
    expect(explain).toBeDefined()
    expect(explain?.isPrimary).toBe(true)
    expect(explain?.isCustomized).toBe(false)
  })

  it('updates a preset label and value, and marks it as customized', () => {
    const { result } = renderHook(() => useQuickAiPresets())

    act(() => {
      result.current.updatePreset('explain', {
        label: 'Detaylı Açıkla',
        value: 'Lütfen bunu adım adım detaylı açıkla'
      })
    })

    const explain = result.current.presets.find((p) => p.key === 'explain')
    expect(explain?.label).toBe('Detaylı Açıkla')
    expect(explain?.value).toBe('Lütfen bunu adım adım detaylı açıkla')
    expect(explain?.isCustomized).toBe(true)
    expect(result.current.hasAnyCustomized).toBe(true)
  })

  it('resets a single preset back to default', () => {
    const { result } = renderHook(() => useQuickAiPresets())

    act(() => {
      result.current.updatePreset('quiz', {
        label: 'Zor Soru'
      })
    })

    expect(result.current.presets.find((p) => p.key === 'quiz')?.isCustomized).toBe(true)

    act(() => {
      result.current.resetPreset('quiz')
    })

    expect(result.current.presets.find((p) => p.key === 'quiz')?.isCustomized).toBe(false)
    expect(result.current.hasAnyCustomized).toBe(false)
  })

  it('resets all presets with resetAllPresets', () => {
    const { result } = renderHook(() => useQuickAiPresets())

    act(() => {
      result.current.updatePreset('explain', { label: 'Özel 1' })
      result.current.updatePreset('summarize', { label: 'Özel 2' })
    })

    expect(result.current.hasAnyCustomized).toBe(true)

    act(() => {
      result.current.resetAllPresets()
    })

    expect(result.current.hasAnyCustomized).toBe(false)
    expect(result.current.presets.every((p) => !p.isCustomized)).toBe(true)
  })
})
