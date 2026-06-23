/**
 * Tests for src/platform/electron/api/useAutomationApi.ts
 *
 * Covers script generation mutations for automation.
 */
import {
  useGenerateAutoSendScript,
  useGenerateClickSendScript,
  useGenerateFocusScript,
  useGeneratePickerScript,
  useGenerateValidateSelectorsScript,
  useGenerateWaitForSubmitReadyScript
} from '@platform/electron/api/useAutomationApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(),
  hasElectronApi: vi.fn().mockReturnValue(true)
}))

describe('useAutomationApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockAutomation: any

  beforeEach(() => {
    vi.restoreAllMocks()

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    mockAutomation = {
      generateFocusScript: vi.fn().mockResolvedValue('console.log("focus")'),
      generateClickSendScript: vi.fn().mockResolvedValue('console.log("clickSend")'),
      generateAutoSendScript: vi.fn().mockResolvedValue('console.log("autoSend")'),
      generateValidateSelectorsScript: vi.fn().mockResolvedValue('console.log("validate")'),
      generateWaitForSubmitReadyScript: vi.fn().mockResolvedValue('console.log("wait")'),
      generatePickerScript: vi.fn().mockResolvedValue('console.log("picker")')
    }

    vi.mocked(getElectronApi).mockReturnValue({
      automation: mockAutomation
    } as any)
  })

  const mockConfig = {
    inputFingerprint: { tag: 'textarea', localPath: ['body'] },
    buttonFingerprint: { tag: 'button', text: 'Send' }
  }

  it('useGenerateFocusScript generates a focus script', async () => {
    const { result } = renderHook(() => useGenerateFocusScript(), { wrapper })
    const script = await result.current.mutateAsync(mockConfig as any)
    expect(mockAutomation.generateFocusScript).toHaveBeenCalledWith(mockConfig)
    expect(script).toBe('console.log("focus")')
  })

  it('useGenerateClickSendScript generates a click-and-send script', async () => {
    const { result } = renderHook(() => useGenerateClickSendScript(), { wrapper })
    const script = await result.current.mutateAsync(mockConfig as any)
    expect(mockAutomation.generateClickSendScript).toHaveBeenCalledWith(mockConfig)
    expect(script).toBe('console.log("clickSend")')
  })

  it('useGenerateAutoSendScript generates auto-send script with text', async () => {
    const { result } = renderHook(() => useGenerateAutoSendScript(), { wrapper })
    const params = {
      config: mockConfig as any,
      text: 'Hello',
      submit: true,
      append: false,
      textInputMode: 'type' as any,
      typingSpeed: 50
    }
    const script = await result.current.mutateAsync(params)
    expect(mockAutomation.generateAutoSendScript).toHaveBeenCalledWith(
      mockConfig,
      'Hello',
      true,
      false,
      'type',
      50
    )
    expect(script).toBe('console.log("autoSend")')
  })

  it('useGenerateAutoSendScript works without optional params', async () => {
    const { result } = renderHook(() => useGenerateAutoSendScript(), { wrapper })
    const params = {
      config: mockConfig as any,
      text: 'Hi',
      submit: false
    }
    await result.current.mutateAsync(params as any)
    // append === true evaluates to false when append is undefined
    expect(mockAutomation.generateAutoSendScript).toHaveBeenCalledWith(
      mockConfig,
      'Hi',
      false,
      false,
      undefined,
      undefined
    )
  })

  it('useGenerateValidateSelectorsScript generates validation script', async () => {
    const { result } = renderHook(() => useGenerateValidateSelectorsScript(), { wrapper })
    await result.current.mutateAsync(mockConfig as any)
    expect(mockAutomation.generateValidateSelectorsScript).toHaveBeenCalledWith(mockConfig)
  })

  it('useGenerateWaitForSubmitReadyScript generates wait script with options', async () => {
    const { result } = renderHook(() => useGenerateWaitForSubmitReadyScript(), { wrapper })
    const params = {
      config: mockConfig as any,
      options: { timeoutMs: 5000, settleMs: 500 }
    }
    await result.current.mutateAsync(params as any)
    expect(mockAutomation.generateWaitForSubmitReadyScript).toHaveBeenCalledWith(mockConfig, {
      timeoutMs: 5000,
      settleMs: 500
    })
  })

  it('useGeneratePickerScript generates picker script with translations', async () => {
    const { result } = renderHook(() => useGeneratePickerScript(), { wrapper })
    const translations = { picker_title: 'Select element' }
    await result.current.mutateAsync(translations)
    expect(mockAutomation.generatePickerScript).toHaveBeenCalledWith(translations)
  })

  it('returns null when Electron API returns null', async () => {
    mockAutomation.generateFocusScript.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useGenerateFocusScript(), { wrapper })
    const script = await result.current.mutateAsync(mockConfig as any)
    expect(script).toBeNull()
  })
})
