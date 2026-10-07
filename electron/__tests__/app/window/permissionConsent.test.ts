import { dialog } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  resetConsentPromptsForTesting,
  resolveWebPermission
} from '../../../app/window/permissionConsent.js'
import {
  evaluateWebPermission,
  resetConsentDecisions
} from '../../../app/window/permissionPolicy.js'

vi.mock('electron', () => ({
  dialog: {
    showMessageBox: vi.fn()
  }
}))

vi.mock('../../../core/logger.js', () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

describe('window/permissionConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetConsentDecisions()
    resetConsentPromptsForTesting()
  })

  it('isolates concurrent prompts across different hosts and partitions', async () => {
    let resolveFirstDialog!: (val: { response: number; checkboxChecked: boolean }) => void
    const firstDialogPromise = new Promise<{ response: number; checkboxChecked: boolean }>(
      (resolve) => {
        resolveFirstDialog = resolve
      }
    )

    const showMessageBoxMock = vi.mocked(dialog.showMessageBox)
    showMessageBoxMock.mockImplementationOnce(() => firstDialogPromise)
    showMessageBoxMock.mockImplementationOnce(async () => ({ response: 0, checkboxChecked: false })) // Block second

    const reqA = {
      partition: 'persist:ai_chatgpt',
      permission: 'media',
      requestingUrl: 'https://chatgpt.com/',
      isMainFrame: true
    }
    const decA = evaluateWebPermission(reqA)

    const reqB = {
      partition: 'persist:ai_claude',
      permission: 'media',
      requestingUrl: 'https://claude.ai/',
      isMainFrame: true
    }
    const decB = evaluateWebPermission(reqB)

    // Fire both concurrently
    const promiseA = resolveWebPermission(reqA, decA, () => null)
    const promiseB = resolveWebPermission(reqB, decB, () => null)

    // Host B should have triggered its own dialog prompt rather than piggybacking on Host A
    expect(showMessageBoxMock).toHaveBeenCalledTimes(2)

    // Resolve Host A with Allow (response: 1)
    resolveFirstDialog({ response: 1, checkboxChecked: false })

    const [resultA, resultB] = await Promise.all([promiseA, promiseB])
    expect(resultA).toBe(true)
    expect(resultB).toBe(false)
  })

  it('coalesces concurrent requests for the same host, partition and capability', async () => {
    let resolveDialog!: (val: { response: number; checkboxChecked: boolean }) => void
    const dialogPromise = new Promise<{ response: number; checkboxChecked: boolean }>((resolve) => {
      resolveDialog = resolve
    })

    const showMessageBoxMock = vi.mocked(dialog.showMessageBox)
    showMessageBoxMock.mockImplementationOnce(() => dialogPromise)

    const reqA = {
      partition: 'persist:ai_chatgpt',
      permission: 'media',
      requestingUrl: 'https://chatgpt.com/',
      isMainFrame: true
    }
    const decA = evaluateWebPermission(reqA)

    const promise1 = resolveWebPermission(reqA, decA, () => null)
    const promise2 = resolveWebPermission(reqA, decA, () => null)

    expect(showMessageBoxMock).toHaveBeenCalledTimes(1)

    resolveDialog({ response: 1, checkboxChecked: false })
    const [res1, res2] = await Promise.all([promise1, promise2])
    expect(res1).toBe(true)
    expect(res2).toBe(true)
  })
})
