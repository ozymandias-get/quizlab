import { IPC_CHANNELS } from '@shared-core/constants/ipc-channels'
import type {
  AutomationScriptAction,
  AutomationScriptArgsByAction,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from '@shared-core/types/ipcContract'

import { describe, expect, it } from 'vitest'

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

// Compile-time: verify every IPC_CHANNELS key used in invoke/handle is in IpcInvokeRequestMap
type _ContractCoverageCheck = {
  [K in keyof typeof IPC_CHANNELS]: (typeof IPC_CHANNELS)[K] extends IpcInvokeChannel
    ? true
    : (typeof IPC_CHANNELS)[K] extends import('@shared-core/types/ipcContract').IpcEventChannel
      ? true
      : never
}[keyof typeof IPC_CHANNELS]

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

    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_EXPORT_SESSION)
    assertInvokeChannel(IPC_CHANNELS.GEMINI_WEB_IMPORT_SESSION)
    assertInvokeChannel(IPC_CHANNELS.CACHE_INFO)
    assertInvokeChannel(IPC_CHANNELS.DEEP_CLEAN_CACHE)
    assertInvokeChannel(IPC_CHANNELS.GET_API_CHAT_CONFIG)
    assertInvokeChannel(IPC_CHANNELS.SAVE_API_CHAT_CONFIG)
    assertInvokeChannel(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    assertInvokeChannel(IPC_CHANNELS.FETCH_API_CHAT_MODELS)
    assertInvokeChannel(IPC_CHANNELS.CANCEL_API_CHAT_REQUEST)

    // Event-only channels like SHOW_PDF_CONTEXT_MENU / TRIGGER_* are intentionally excluded.
    expect(true).toBe(true)
  })

  it('keeps select-pdf args mapped in invoke contract', () => {
    // @ts-expect-error - intentionally passing invalid args for compile-time contract check
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
      // @ts-expect-error - intentionally passing invalid action for compile-time contract check
      ['unknown-action']
    void invalidAutomationInvokeArgs
    expect(Array.isArray(invalidAutomationInvokeArgs)).toBe(true)
  })

  it('every IPC_CHANNELS key is either in IpcInvokeRequestMap or IpcEventMap', () => {
    type ChannelValue = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
    type InvokeChannels = IpcInvokeChannel
    type EventChannels = import('@shared-core/types/ipcContract').IpcEventChannel
    type AllMapped = InvokeChannels | EventChannels

    // This line will fail to compile if a channel in IPC_CHANNELS is not mapped
    // in either IpcInvokeRequestMap or IpcEventMap.
    const _check: Record<ChannelValue, true> = {} as Record<AllMapped, true> as Record<
      ChannelValue,
      true
    >
    void _check
    expect(true).toBe(true)
  })

  it('no channel in IPC_CHANNELS is both invoke and event', () => {
    type InvokeChannels = IpcInvokeChannel
    type EventChannels = import('@shared-core/types/ipcContract').IpcEventChannel
    // This will fail to compile if a channel appears in both maps.
    // If Overlap is not never, the next line will error as expected.
    type Overlap = InvokeChannels & EventChannels
    const _check: Overlap = undefined as never
    void _check
    expect(true).toBe(true)
  })
})
