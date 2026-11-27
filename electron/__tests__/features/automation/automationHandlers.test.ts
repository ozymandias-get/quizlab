import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const trustedSender = { id: 1, getURL: vi.fn(() => 'http://localhost:5173') }
const trustedEvent = { sender: trustedSender, type: 'invoke' }
const generateFocusScript = vi.fn()
const generateClickSendScript = vi.fn()
const generateAutoSendScript = vi.fn()
const generateValidateSelectorsScript = vi.fn()
const generateWaitForSubmitReadyScript = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/tmp/quizlab-test')
  },
  ipcMain: {
    handle: ipcHandle
  }
}))

vi.mock('../../../features/automation/automationScripts', () => ({
  generateFocusScript,
  generateClickSendScript,
  generateAutoSendScript,
  generateValidateSelectorsScript,
  generateWaitForSubmitReadyScript
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow: vi.fn(() => ({
    webContents: trustedSender
  }))
}))

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('automationHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    generateFocusScript.mockReset()
    generateClickSendScript.mockReset()
    generateAutoSendScript.mockReset()
    generateValidateSelectorsScript.mockReset()
    generateWaitForSubmitReadyScript.mockReset()
  })

  it('routes action-specific args and normalizes a missing append flag to false', async () => {
    generateAutoSendScript.mockReturnValue('auto-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const config = { input: '#prompt', button: '#send' }

    // `generateAutoSendScript` yalnızca 3 argümanla çağrılır: `append`
    // dördüncü argümandır ve yoksa `false` olmalıdır.
    const explicit = await handler?.(
      trustedEvent,
      'generateAutoSendScript',
      config,
      'hello',
      false,
      true
    )
    expect(explicit).toEqual({ ok: true, data: 'auto-script' })
    expect(generateAutoSendScript).toHaveBeenLastCalledWith(
      config,
      'hello',
      false,
      true,
      undefined,
      undefined
    )

    const omitted = await handler?.(
      trustedEvent,
      'generateAutoSendScript',
      { input: '#prompt' },
      'hello',
      true
    )
    expect(omitted).toEqual({ ok: true, data: 'auto-script' })
    expect(generateAutoSendScript).toHaveBeenLastCalledWith(
      { input: '#prompt' },
      'hello',
      true,
      false,
      undefined,
      undefined
    )
  })

  it('forwards optional args for wait action', async () => {
    generateWaitForSubmitReadyScript.mockReturnValue('wait-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const config = { input: '#prompt' }
    const options = { timeoutMs: 9000, settleMs: 100 }

    const waitResult = await handler?.(
      trustedEvent,
      'generateWaitForSubmitReadyScript',
      config,
      options
    )
    expect(waitResult).toEqual({ ok: true, data: 'wait-script' })
    expect(generateWaitForSubmitReadyScript).toHaveBeenLastCalledWith(config, options)

    // Options may be omitted entirely.
    const waitOk = await handler?.(trustedEvent, 'generateWaitForSubmitReadyScript', config)
    expect(waitOk).toEqual({ ok: true, data: 'wait-script' })
    expect(generateWaitForSubmitReadyScript).toHaveBeenLastCalledWith(config, undefined)

    // Malformed payloads are rejected by the IPC guard.
    for (const invalidCall of [
      () => handler?.(trustedEvent, 'generateWaitForSubmitReadyScript', config, 123 as never)
    ]) {
      expect(await invalidCall()).toEqual({
        ok: false,
        error: { code: 'invalid_input', message: 'Invalid action or arguments' }
      })
    }
  })

  it('routes focus/click/validate actions to their generators', async () => {
    generateFocusScript.mockReturnValue('focus-script')
    generateClickSendScript.mockReturnValue('click-script')
    generateValidateSelectorsScript.mockReturnValue('validate-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const config = { input: '#prompt', button: '#send' }

    const focus = await handler?.(trustedEvent, 'generateFocusScript', config)
    const click = await handler?.(trustedEvent, 'generateClickSendScript', config)
    const validate = await handler?.(trustedEvent, 'generateValidateSelectorsScript', config)

    expect(focus).toEqual({ ok: true, data: 'focus-script' })
    expect(click).toEqual({ ok: true, data: 'click-script' })
    expect(validate).toEqual({ ok: true, data: 'validate-script' })
    expect(generateFocusScript).toHaveBeenCalledWith(config)
    expect(generateClickSendScript).toHaveBeenCalledWith(config)
    expect(generateValidateSelectorsScript).toHaveBeenCalledWith(config)
  })

  it('returns null for unknown automation actions', async () => {
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const result = await handler?.(trustedEvent, 'unknown-action' as never)

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid_input', message: 'Invalid action or arguments' }
    })
  })

  it('returns null when action args are malformed', async () => {
    generateAutoSendScript.mockReturnValue('auto-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const result = await handler?.(trustedEvent, 'generateAutoSendScript', null, 123, 'yes')

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid_input', message: 'Invalid action or arguments' }
    })
    expect(generateAutoSendScript).not.toHaveBeenCalled()
  })

  it('returns null and logs when script generator throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    generateAutoSendScript.mockImplementation(() => {
      throw new Error('boom')
    })
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const config = { input: '#prompt' }
    const result = await handler?.(trustedEvent, 'generateAutoSendScript', config, 'hello', true)

    expect(result).toEqual({ ok: false, error: { code: 'internal_error', message: 'boom' } })
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('blocks untrusted sender requests', async () => {
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const result = await handler?.(
      { sender: { id: 404 }, type: 'invoke' },
      'generateAutoSendScript',
      { input: '#prompt' },
      'hello',
      true
    )

    expect(result).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized' }
    })
    expect(generateAutoSendScript).not.toHaveBeenCalled()
    expect(generateFocusScript).not.toHaveBeenCalled()
    expect(generateClickSendScript).not.toHaveBeenCalled()
    expect(generateValidateSelectorsScript).not.toHaveBeenCalled()
    expect(generateWaitForSubmitReadyScript).not.toHaveBeenCalled()
  })
})
