/**
 * AI Feature — Public API
 *
 * Everything outside `src/features/ai` must import from here (or from the
 * `./webview` lazy chunk). The app shell wires the AI provider graph, so the
 * send pipeline types, the per-tab UI store and the auto-send resolver are
 * part of the public surface.
 */

export type { AiLifecycleSettingsReturn } from './hooks/useAiLifecycleSettings'
export {
  MAX_ALIVE_TABS_OPTIONS,
  SLEEP_TIMEOUT_OPTIONS,
  useAiLifecycleSettings
} from './hooks/useAiLifecycleSettings'
export { useAiSender } from './hooks/useAiSender'
export { usePrompts } from './hooks/usePrompts'
export {
  type QuickPresetItem,
  type QuickPresetKey,
  useQuickAiPresets
} from './hooks/useQuickAiPresets'
export type { UseTextInputModeReturn } from './hooks/useTextInputMode'
export { TYPING_SPEED_OPTIONS, useTextInputMode } from './hooks/useTextInputMode'
export { normalizeExecutionResult } from './lib/send/scriptExecution'
export { resolveAutoSend } from './lib/sendUtils'
export type { AiSendOptions, AiSendResult } from './model/types'
export type { SendApiChatResult } from './queries/useSendMessageMutation'
export { sendApiChatMessage, useSendMessageMutation } from './queries/useSendMessageMutation'
export { useChatUiStore } from './store/chatUiStore'
