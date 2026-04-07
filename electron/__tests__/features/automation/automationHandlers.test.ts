import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_CONFIG } from '../../../app/constants'

const ipcHandle = vi.fn()
const trustedSender = { id: 1 }
const trustedEvent = { sender: trustedSender, type: 'invoke' }
const generateFocusScript = vi.fn()
const generateClickSendScript = vi.fn()
const generateAutoSendScript = vi.fn()
const generateValidateSelectorsScript = vi.fn()
const generateWaitForSubmitReadyScript = vi.fn()
const generatePickerScript = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => 'C:/tmp')
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

vi.mock('../../../features/automation/userElementPicker', () => ({
  generatePickerScript
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
    generatePickerScript.mockReset()
  })

  it('registers automation scripts handler and routes action-specific args', async () => {
    generateAutoSendScript.mockReturnValue('auto-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const config = { input: '#prompt', button: '#send' }
    const result = await handler?.(
      trustedEvent,
      'generateAutoSendScript',
      config,
      'hello',
      false,
      true
    )

    expect(result).toBe('auto-script')
    expect(generateAutoSendScript).toHaveBeenCalledWith(config, 'hello', false, true)
  })

  it('normalizes missing append flag to false for auto-send action', async () => {
    generateAutoSendScript.mockReturnValue('auto-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const config = { input: '#prompt' }
    const result = await handler?.(trustedEvent, 'generateAutoSendScript', config, 'hello', true)

    expect(result).toBe('auto-script')
    expect(generateAutoSendScript).toHaveBeenCalledWith(config, 'hello', true, false)
  })

  it('forwards optional args for wait action and picker translations', async () => {
    generateWaitForSubmitReadyScript.mockReturnValue('wait-script')
    generatePickerScript.mockReturnValue('picker-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const config = { input: '#prompt' }
    const options = { timeoutMs: 9000, settleMs: 100 }
    const translations = { pickInput: 'Pick input' }

    const waitResult = await handler?.(
      trustedEvent,
      'generateWaitForSubmitReadyScript',
      config,
      options
    )
    const pickerResult = await handler?.(trustedEvent, 'generatePickerScript', translations)

    expect(waitResult).toBe('wait-script')
    expect(generateWaitForSubmitReadyScript).toHaveBeenCalledWith(config, options)
    expect(pickerResult).toBe('picker-script')
    expect(generatePickerScript).toHaveBeenCalledWith(translations)
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

    expect(focus).toBe('focus-script')
    expect(click).toBe('click-script')
    expect(validate).toBe('validate-script')
    expect(generateFocusScript).toHaveBeenCalledWith(config)
    expect(generateClickSendScript).toHaveBeenCalledWith(config)
    expect(generateValidateSelectorsScript).toHaveBeenCalledWith(config)
  })

  it('accepts undefined wait options and rejects malformed wait/picker payloads', async () => {
    generateWaitForSubmitReadyScript.mockReturnValue('wait-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const config = { input: '#prompt' }

    const waitOk = await handler?.(trustedEvent, 'generateWaitForSubmitReadyScript', config)
    const waitInvalid = await handler?.(
      trustedEvent,
      'generateWaitForSubmitReadyScript',
      config,
      123 as never
    )
    const pickerInvalid = await handler?.(trustedEvent, 'generatePickerScript', null)

    expect(waitOk).toBe('wait-script')
    expect(generateWaitForSubmitReadyScript).toHaveBeenCalledWith(config, undefined)
    expect(waitInvalid).toBeNull()
    expect(pickerInvalid).toBeNull()
  })

  it('returns null for unknown automation actions', async () => {
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const result = await handler?.(trustedEvent, 'unknown-action' as never)

    expect(result).toBeNull()
  })

  it('returns null when action args are malformed', async () => {
    generateAutoSendScript.mockReturnValue('auto-script')
    const { registerAutomationHandlers } =
      await import('../../../features/automation/automationHandlers.js')
    registerAutomationHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    const result = await handler?.(trustedEvent, 'generateAutoSendScript', null, 123, 'yes')

    expect(result).toBeNull()
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

    expect(result).toBeNull()
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

    expect(result).toBeNull()
    expect(generateAutoSendScript).not.toHaveBeenCalled()
    expect(generateFocusScript).not.toHaveBeenCalled()
    expect(generateClickSendScript).not.toHaveBeenCalled()
    expect(generateValidateSelectorsScript).not.toHaveBeenCalled()
    expect(generateWaitForSubmitReadyScript).not.toHaveBeenCalled()
    expect(generatePickerScript).not.toHaveBeenCalled()
  })
})
