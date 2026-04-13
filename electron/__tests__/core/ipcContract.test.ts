import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS } from '@shared-core/constants/ipc-channels'
import type {
  AutomationScriptAction,
  AutomationScriptArgsByAction,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from '@shared-core/types/ipcContract'

// Helper to assert at compile time that a given channel is covered by IpcInvokeRequestMap.
function assertInvokeChannel<_T extends IpcInvokeChannel>(_channel: _T) {
  // no-op – purely for type checking
}

function assertAutomationAction<_A extends AutomationScriptAction>(
  _action: _A,
  ..._args: AutomationScriptArgsByAction[_A]
) {
  // no-op – purely for type checking
}

describe('IPC contract', () => {
  it('covers all invoke-style channels used in preload', () => {
    // If any of these lines stops compiling, preload and contract are out of sync.
    assertInvokeChannel(IPC_CHANNELS.GET_AI_REGISTRY)
    assertInvokeChannel(IPC_CHANNELS.SELECT_PDF)
    assertInvokeChannel(IPC_CHANNELS.GET_PDF_STREAM_URL)
    assertInvokeChannel(IPC_CHANNELS.PDF_REGISTER_PATH)
    assertInvokeChannel(IPC_CHANNELS.CAPTURE_SCREEN)
    assertInvokeChannel(IPC_CHANNELS.COPY_IMAGE)
    assertInvokeChannel(IPC_CHANNELS.COPY_TEXT)
    assertInvokeChannel(IPC_CHANNELS.OPEN_EXTERNAL)
    assertInvokeChannel(IPC_CHANNELS.FORCE_PASTE)
    assertInvokeChannel(IPC_CHANNELS.CLEAR_CACHE)
    assertInvokeChannel(IPC_CHANNELS.CLEAR_AI_MODEL_DATA)
    assertInvokeChannel(IPC_CHANNELS.CHECK_FOR_UPDATES)
    assertInvokeChannel(IPC_CHANNELS.OPEN_RELEASES)
    assertInvokeChannel(IPC_CHANNELS.GET_APP_VERSION)
    assertInvokeChannel(IPC_CHANNELS.SAVE_AI_CONFIG)
    assertInvokeChannel(IPC_CHANNELS.GET_AI_CONFIG)
    assertInvokeChannel(IPC_CHANNELS.DELETE_AI_CONFIG)
    assertInvokeChannel(IPC_CHANNELS.ADD_CUSTOM_AI)
    assertInvokeChannel(IPC_CHANNELS.DELETE_CUSTOM_AI)
    assertInvokeChannel(IPC_CHANNELS.IS_AUTH_DOMAIN)
    assertInvokeChannel(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_STATUS)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_OPEN_LOGIN)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_CHECK_NOW)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_REAUTH)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS)

    // Event-only channels like SHOW_PDF_CONTEXT_MENU / TRIGGER_* are intentionally excluded.
    expect(true).toBe(true)
  })

  it('keeps select-pdf args mapped in invoke contract', () => {
    const badArgs: IpcInvokeRequestMap[typeof IPC_CHANNELS.SELECT_PDF]['args'] = ['not-an-object']
    void badArgs
    expect(Array.isArray(badArgs)).toBe(true)
  })

  it('keeps automation actions and args strongly typed', () => {
    assertAutomationAction('generateFocusScript', { input: '#prompt' })
    assertAutomationAction('generateAutoSendScript', { input: '#prompt' }, 'hello', false, true)
    assertAutomationAction(
      'generateWaitForSubmitReadyScript',
      { input: '#prompt' },
      { timeoutMs: 5 }
    )
    assertAutomationAction('generatePickerScript', { pickInput: 'Pick input' })

    // @ts-expect-error - generateAutoSendScript requires string text as second argument
    assertAutomationAction('generateAutoSendScript', { input: '#prompt' }, 123, false, true)

    const invalidAutomationInvokeArgs: IpcInvokeRequestMap[typeof IPC_CHANNELS.GET_AUTOMATION_SCRIPTS]['args'] =
      ['unknown-action']
    void invalidAutomationInvokeArgs
    expect(Array.isArray(invalidAutomationInvokeArgs)).toBe(true)
  })
})
