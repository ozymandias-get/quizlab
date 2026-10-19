import { IPC_CHANNELS } from '@shared-core/constants/ipcChannels'
import type { ElectronApi } from '@shared-core/types/electronApi'
import type {
  AutomationScriptAction,
  AutomationScriptArgsByAction,
  IpcEventChannel,
  IpcEventMap,
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

// Helper to assert at compile time that an event channel's payload tuple accepts
// the given arguments, i.e. that the preload callback for it is typed.
function assertEventArgs<_C extends IpcEventChannel>(
  _channel: _C,
  ..._args: IpcEventMap[_C]['args']
) {
  // no-op – purely for type checking
}

// Compile-time: every key of IPC_CHANNELS must be declared in either
// IpcInvokeRequestMap (invoke/handle) or IpcEventMap (send/on).
//
// The mapping is deliberately INVERTED — a covered channel maps to `never` and
// an uncovered one maps to its own key. Indexing the result therefore yields
// `never` only when *all* channels are covered. Mapping covered channels to
// `true` and uncovered ones to `never` (the previous shape) could never fail,
// because `never` is absorbed into any union it is joined to.
type UncoveredIpcChannels = {
  [K in keyof typeof IPC_CHANNELS]: (typeof IPC_CHANNELS)[K] extends
    IpcInvokeChannel | IpcEventChannel
    ? never
    : (typeof IPC_CHANNELS)[K]
}[keyof typeof IPC_CHANNELS]

/** Fails to compile unless `T` is `never` — i.e. unless nothing is uncovered. */
type AssertNever<T extends never> = T

// Exported so the assertion is evaluated and retained; never used at runtime.
export type AllIpcChannelsCovered = AssertNever<UncoveredIpcChannels>

// Contract ↔ ElectronApi payload parity
//
// electronApi.ts is hand-written and keyed by method name rather than channel
// name, so the two cannot be mechanically derived from each other. What can be
// asserted is the direction that actually broke once: the renderer-facing result
// must never be NARROWER than the contract's payload.
//
// A renderer type that is wider (the deliberate `| null` widening, documented on
// ElectronApi) is fine and is excluded below. A missing payload field, a renamed
// field or a changed payload type resolves to `never` and breaks the build — which
// is exactly the NATIVE_MESSAGING_INSTALL_EXTENSION `installedPath` drift.

/** The success payload the main process resolves for an invoke channel. */
type ChannelData<C extends IpcInvokeChannel> = Extract<
  IpcInvokeRequestMap[C]['result'],
  { ok: true }
>['data']

/**
 * `true` when the contract payload fits the renderer-facing result, `false`
 * when it does not.
 *
 * Two things this deliberately gets right:
 *   - `ReturnType` is required: `Awaited<M>` on a function type yields the
 *     function itself, which silently compares unequal to every payload.
 *   - The failure branch is `false`, not `never`: `never` is absorbed by every
 *     union it joins, so `[never, true] extends true[]` would still hold and the
 *     assertion could never fail.
 */
type RendererCovers<C extends IpcInvokeChannel, M extends (...args: never[]) => unknown> =
  ChannelData<C> extends Exclude<Awaited<ReturnType<M>>, null> ? true : false

type RendererParityChecks = [
  RendererCovers<typeof IPC_CHANNELS.GET_AI_REGISTRY, ElectronApi['getAiRegistry']>,
  RendererCovers<typeof IPC_CHANNELS.GET_PDF_STREAM_URL, ElectronApi['getPdfStreamUrl']>,
  RendererCovers<typeof IPC_CHANNELS.PDF_REGISTER_PATH, ElectronApi['registerPdfPath']>,
  RendererCovers<typeof IPC_CHANNELS.CAPTURE_SCREEN, ElectronApi['captureScreen']>,
  RendererCovers<typeof IPC_CHANNELS.GET_APP_SETTINGS, ElectronApi['getAppSettings']>,
  RendererCovers<typeof IPC_CHANNELS.GET_API_CHAT_CONFIG, ElectronApi['getApiChatConfig']>,
  RendererCovers<typeof IPC_CHANNELS.SEND_API_CHAT_REQUEST, ElectronApi['sendApiChatRequest']>,
  RendererCovers<typeof IPC_CHANNELS.FETCH_API_CHAT_MODELS, ElectronApi['fetchApiChatModels']>,
  RendererCovers<typeof IPC_CHANNELS.GET_AI_CONFIG, ElectronApi['getAiConfig']>,
  RendererCovers<
    typeof IPC_CHANNELS.SHELL_INTEGRATION_STATUS,
    ElectronApi['shellIntegration']['getStatus']
  >,
  RendererCovers<typeof IPC_CHANNELS.GEMINI_WEB_STATUS, ElectronApi['geminiWeb']['getStatus']>,
  RendererCovers<
    typeof IPC_CHANNELS.NATIVE_MESSAGING_STATUS,
    ElectronApi['nativeMessaging']['getStatus']
  >,
  RendererCovers<
    typeof IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION,
    ElectronApi['nativeMessaging']['installExtension']
  >,
  RendererCovers<typeof IPC_CHANNELS.AI_VIEW_ATTACH, ElectronApi['aiView']['attach']>,
  // Channels whose contract data is genuinely nullable must keep the `| null`
  // in the renderer-facing signature, so they are excluded from the widening.
  RendererCovers<typeof IPC_CHANNELS.AI_VIEW_DETACH, ElectronApi['aiView']['detach']>
]

/** Fails to compile unless every entry of `T` is `true`. */
type AssertAllTrue<T extends true[]> = T

// Exported so the assertion is evaluated and retained; never used at runtime.
export type RendererCoversContract = AssertAllTrue<RendererParityChecks>

/**
 * Key-set equality, both directions.
 *
 * Assignability on its own has a blind spot: `{ a: string }` IS assignable to
 * `{ a: string; b?: number }`, so deleting an optional field from either side is
 * invisible. That is precisely how NATIVE_MESSAGING_INSTALL_EXTENSION dropped
 * `installedPath` from the contract without any type failing.
 *
 * Only meaningful for plain object payloads: `keyof` a union yields the
 * *intersection* of its members' keys, and `keyof` a type with an index
 * signature is `string`, so neither has a well-defined exact key set. Those
 * channels stay covered by the assignability table alone and are excluded below.
 */
type ExactKeys<A, B> =
  Exclude<keyof A, keyof B> extends never
    ? Exclude<keyof B, keyof A> extends never
      ? true
      : false
    : false

type RendererKeysMatch<
  C extends IpcInvokeChannel,
  M extends (...args: never[]) => unknown
> = ExactKeys<ChannelData<C>, Exclude<Awaited<ReturnType<M>>, null>>

type RendererKeyParityChecks = [
  RendererKeysMatch<typeof IPC_CHANNELS.GET_AI_REGISTRY, ElectronApi['getAiRegistry']>,
  RendererKeysMatch<typeof IPC_CHANNELS.GET_PDF_STREAM_URL, ElectronApi['getPdfStreamUrl']>,
  RendererKeysMatch<typeof IPC_CHANNELS.PDF_REGISTER_PATH, ElectronApi['registerPdfPath']>,
  RendererKeysMatch<typeof IPC_CHANNELS.CAPTURE_SCREEN, ElectronApi['captureScreen']>,
  RendererKeysMatch<typeof IPC_CHANNELS.GET_APP_SETTINGS, ElectronApi['getAppSettings']>,
  RendererKeysMatch<typeof IPC_CHANNELS.GET_API_CHAT_CONFIG, ElectronApi['getApiChatConfig']>,
  RendererKeysMatch<typeof IPC_CHANNELS.SEND_API_CHAT_REQUEST, ElectronApi['sendApiChatRequest']>,
  RendererKeysMatch<typeof IPC_CHANNELS.FETCH_API_CHAT_MODELS, ElectronApi['fetchApiChatModels']>,
  RendererKeysMatch<
    typeof IPC_CHANNELS.SHELL_INTEGRATION_STATUS,
    ElectronApi['shellIntegration']['getStatus']
  >,
  RendererKeysMatch<typeof IPC_CHANNELS.GEMINI_WEB_STATUS, ElectronApi['geminiWeb']['getStatus']>,
  RendererKeysMatch<
    typeof IPC_CHANNELS.NATIVE_MESSAGING_STATUS,
    ElectronApi['nativeMessaging']['getStatus']
  >,
  RendererKeysMatch<
    typeof IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION,
    ElectronApi['nativeMessaging']['installExtension']
  >,
  RendererKeysMatch<typeof IPC_CHANNELS.AI_VIEW_ATTACH, ElectronApi['aiView']['attach']>,
  RendererKeysMatch<typeof IPC_CHANNELS.AI_VIEW_DETACH, ElectronApi['aiView']['detach']>,
  // GET_AI_CONFIG is deliberately absent: its payload is
  // `AiSelectorConfig | Record<string, AiSelectorConfig>`, a union that includes
  // an index signature, so `keyof` has no exact answer for it. The assignability
  // table still covers it.
  RendererKeysMatch<typeof IPC_CHANNELS.AI_VIEW_LOAD_URL, ElectronApi['aiView']['loadUrl']>
]

export type RendererKeysMatchContract = AssertAllTrue<RendererKeyParityChecks>

// The one field whose absence went unnoticed: asserted explicitly on both sides.
type InstallChannelData = ChannelData<typeof IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION>
type InstallRendererPayload = Exclude<
  Awaited<ElectronApi['nativeMessaging']['installExtension']>,
  null
>
export type InstallPathDeclaredEverywhere = 'installedPath' extends keyof InstallChannelData
  ? 'installedPath' extends keyof InstallRendererPayload
    ? true
    : false
  : false

// Runtime witness so the exported types above are not elided as unused.
const rendererIsNotNarrower: RendererCoversContract extends true[] ? true : false = true
const rendererKeysMatch: RendererKeysMatchContract extends true[] ? true : false = true

// Everything below this line is a COMPILE-TIME assertion, not a runtime one:
// each helper body is an empty function whose only job is to make `tsc -b`
// (tsconfig.node.test.json, which includes electron/**/*) reject a drift
// between the contract, the preload and the renderer-facing API. They are
// therefore evaluated at module scope, so they hold for the whole file
// regardless of how many runtime `it()` blocks wrap them. Wrapping them in
// separate `it()`s that ended in `expect(true).toBe(true)` cost nine test
// slots in the report and could never fail at runtime.
//
// If any line in this block stops compiling, preload and contract are out of
// sync. Event-only channels like SHOW_PDF_CONTEXT_MENU / TRIGGER_* are
// intentionally absent from the invoke table below.
assertInvokeChannel(IPC_CHANNELS.GET_AI_REGISTRY)
assertInvokeChannel(IPC_CHANNELS.SELECT_PDF)
assertInvokeChannel(IPC_CHANNELS.GET_PDF_STREAM_URL)
assertInvokeChannel(IPC_CHANNELS.PDF_REGISTER_PATH)
assertInvokeChannel(IPC_CHANNELS.CAPTURE_SCREEN)
assertInvokeChannel(IPC_CHANNELS.COPY_IMAGE)
assertInvokeChannel(IPC_CHANNELS.RESTORE_CLIPBOARD)
assertInvokeChannel(IPC_CHANNELS.COPY_TEXT)
assertInvokeChannel(IPC_CHANNELS.OPEN_EXTERNAL)
assertInvokeChannel(IPC_CHANNELS.AI_VIEW_PASTE)
assertInvokeChannel(IPC_CHANNELS.CLEAR_CACHE)
assertInvokeChannel(IPC_CHANNELS.CLEAR_AI_MODEL_DATA)
assertInvokeChannel(IPC_CHANNELS.CHECK_FOR_UPDATES)
assertInvokeChannel(IPC_CHANNELS.GET_APP_VERSION)
assertInvokeChannel(IPC_CHANNELS.SAVE_AI_CONFIG)
assertInvokeChannel(IPC_CHANNELS.GET_AI_CONFIG)
assertInvokeChannel(IPC_CHANNELS.DELETE_AI_CONFIG)
assertInvokeChannel(IPC_CHANNELS.ADD_CUSTOM_AI)
assertInvokeChannel(IPC_CHANNELS.DELETE_CUSTOM_AI)
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

// SELECT_PDF's contract is `[options?: PdfSelectOptions]`, so an empty tuple is
// legal and a bare string is not. The aliases keep the two declarations below
// under prettier's 100-column width — spelled out inline they run to ~105
// characters, prettier re-wraps them, the `@ts-expect-error` stays on the
// `const` line, and TS reports the mismatch on the array-element line instead.
// That split is what trips TS2578 (unused directive) alongside the real error.
type SelectPdfArgs = IpcInvokeRequestMap[typeof IPC_CHANNELS.SELECT_PDF]['args']
type AutomationArgs = IpcInvokeRequestMap[typeof IPC_CHANNELS.GET_AUTOMATION_SCRIPTS]['args']

// @ts-expect-error - intentionally passing invalid args for compile-time contract check
const invalidSelectPdfArgs: SelectPdfArgs = ['not-an-object']

assertAutomationAction('generateFocusScript', { input: '#prompt' })
assertAutomationAction('generateAutoSendScript', { input: '#prompt' }, 'hello', false, true)
assertAutomationAction('generateWaitForSubmitReadyScript', { input: '#prompt' }, { timeoutMs: 5 })
assertAutomationAction('generatePickerScript', { pickInput: 'Pick input' })

// @ts-expect-error - generateAutoSendScript requires string text as second argument
assertAutomationAction('generateAutoSendScript', { input: '#prompt' }, 123, false, true)

// @ts-expect-error - intentionally passing invalid action for compile-time contract check
const invalidAutomationArgs: AutomationArgs = ['unknown-action']

// Every key of IPC_CHANNELS must be mapped in IpcInvokeRequestMap or IpcEventMap.
// This line fails to compile when one is not.
type ChannelValue = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
const _everyChannelMapped: Record<ChannelValue, true> = {} as Record<
  IpcInvokeChannel | import('@shared-core/types/ipcContract').IpcEventChannel,
  true
> as Record<ChannelValue, true>

// No channel may be both invoke and event. `[Overlap] extends [never]` rather
// than `Overlap`, because `never` is assignable to every type and would compile
// either way — the conditional type only resolves to `true` when the
// intersection is genuinely empty.
type Overlap = IpcInvokeChannel & import('@shared-core/types/ipcContract').IpcEventChannel
const _noChannelIsBoth: [Overlap] extends [never] ? true : false = true

type InstallData = Extract<
  IpcInvokeRequestMap[typeof IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION]['result'],
  { ok: true }
>['data']
function assertResultKey<_K extends keyof InstallData>(_key: _K) {
  // no-op – purely for type checking
}
// nativeMessagingManager.installExtension() resolves `installedPath` and the
// extension wizard reads it. The contract omitted the field while electronApi.ts
// declared it, so nothing failed to compile; this pins the contract to the
// real payload.
assertResultKey('success')
assertResultKey('installedPath')

// onTriggerScreenshot and onPdfViewerZoom used to hand-roll ipcRenderer.on,
// which cost them Parameters<Parameters<...>> casts. Routed through onEvent()
// they are typed by the event map, so both payloads must resolve.
assertEventArgs(IPC_CHANNELS.TRIGGER_SCREENSHOT, 'full-page')
assertEventArgs(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, 'in')

void invalidSelectPdfArgs
void invalidAutomationArgs
void _everyChannelMapped
void _noChannelIsBoth

describe('IPC contract', () => {
  // The two parity checks above resolve to `true` or the file does not compile;
  // `RendererCoversContract extends true[]` is already proven by the annotated
  // consts. This is the runtime witness that keeps those consts from being
  // elided as unused.
  //
  // electronApi.ts is hand-written and keyed by method name, not channel name,
  // so the mapping is explicit. The rule: the contract's payload must be
  // assignable to the renderer-facing result. A wider renderer type (the
  // deliberate `| null` widening documented on ElectronApi) passes; a missing
  // payload field or a changed payload type does not. Key sets are compared in
  // both directions as well, because assignability alone cannot see a dropped
  // *optional* field.
  it('keeps the renderer-facing result in step with the contract payload', () => {
    expect(rendererIsNotNarrower).toBe(true)
    expect(rendererKeysMatch).toBe(true)
  })
})
