import { create } from 'zustand'

interface ChatUiState {
  activeSessionIdByTab: Record<string, string>
  inputValueByTab: Record<string, string>
  attachmentsByTab: Record<string, string[]>
  selectedModelByTab: Record<string, string>
  activeProviderByTab: Record<string, string>
  isStreamingByTab: Record<string, boolean>
  activeStreamingContentByTab: Record<string, string>
  generalPrompt: string
  memoryPrompt: string
  characterPrompt: string
}

interface ChatUiActions {
  setActiveSessionId: (tabId: string, sessionId: string) => void
  updateInput: (tabId: string, val: string) => void
  addAttachment: (tabId: string, data: string) => void
  removeAttachment: (tabId: string, index: number) => void
  clearAttachments: (tabId: string) => void
  setStreaming: (tabId: string, streaming: boolean) => void
  appendStreamingContent: (tabId: string, content: string) => void
  clearStreamingContent: (tabId: string) => void
  setSelectedModel: (tabId: string, model: string) => void
  setActiveProvider: (tabId: string, providerId: string) => void
  setConfigPrompts: (prompts: {
    generalPrompt: string
    memoryPrompt: string
    characterPrompt: string
  }) => void
  resetTabState: (tabId: string) => void
  resetAll: () => void
}

type ChatUiStore = ChatUiState & ChatUiActions

export const useChatUiStore = create<ChatUiStore>((set) => ({
  activeSessionIdByTab: {},
  inputValueByTab: {},
  attachmentsByTab: {},
  selectedModelByTab: {},
  activeProviderByTab: {},
  isStreamingByTab: {},
  activeStreamingContentByTab: {},
  generalPrompt: '',
  memoryPrompt: '',
  characterPrompt: '',

  setActiveSessionId: (tabId, sessionId) =>
    set((s) => ({
      activeSessionIdByTab: { ...s.activeSessionIdByTab, [tabId]: sessionId }
    })),

  updateInput: (tabId, val) =>
    set((s) => ({ inputValueByTab: { ...s.inputValueByTab, [tabId]: val } })),

  addAttachment: (tabId, data) =>
    set((s) => ({
      attachmentsByTab: {
        ...s.attachmentsByTab,
        [tabId]: [...(s.attachmentsByTab[tabId] || []), data]
      }
    })),

  removeAttachment: (tabId, index) =>
    set((s) => ({
      attachmentsByTab: {
        ...s.attachmentsByTab,
        [tabId]: (s.attachmentsByTab[tabId] || []).filter((_, i) => i !== index)
      }
    })),

  clearAttachments: (tabId) =>
    set((s) => ({
      attachmentsByTab: { ...s.attachmentsByTab, [tabId]: [] }
    })),

  setStreaming: (tabId, streaming) =>
    set((s) => ({
      isStreamingByTab: { ...s.isStreamingByTab, [tabId]: streaming }
    })),

  appendStreamingContent: (tabId, content) =>
    set((s) => ({
      activeStreamingContentByTab: {
        ...s.activeStreamingContentByTab,
        [tabId]: (s.activeStreamingContentByTab[tabId] || '') + content
      }
    })),

  clearStreamingContent: (tabId) =>
    set((s) => ({
      activeStreamingContentByTab: { ...s.activeStreamingContentByTab, [tabId]: '' }
    })),

  setSelectedModel: (tabId, model) =>
    set((s) => ({
      selectedModelByTab: { ...s.selectedModelByTab, [tabId]: model }
    })),

  setActiveProvider: (tabId, providerId) =>
    set((s) => ({
      activeProviderByTab: { ...s.activeProviderByTab, [tabId]: providerId }
    })),

  setConfigPrompts: (prompts) =>
    set({
      generalPrompt: prompts.generalPrompt,
      memoryPrompt: prompts.memoryPrompt,
      characterPrompt: prompts.characterPrompt
    }),

  resetTabState: (tabId) =>
    set((s) => {
      const { [tabId]: _a, ...restSession } = s.activeSessionIdByTab
      const { [tabId]: _b, ...restInput } = s.inputValueByTab
      const { [tabId]: _c, ...restAttach } = s.attachmentsByTab
      const { [tabId]: _d, ...restModel } = s.selectedModelByTab
      const { [tabId]: _e, ...restProvider } = s.activeProviderByTab
      const { [tabId]: _f, ...restStreaming } = s.isStreamingByTab
      const { [tabId]: _g, ...restStreamContent } = s.activeStreamingContentByTab
      return {
        activeSessionIdByTab: restSession,
        inputValueByTab: restInput,
        attachmentsByTab: restAttach,
        selectedModelByTab: restModel,
        activeProviderByTab: restProvider,
        isStreamingByTab: restStreaming,
        activeStreamingContentByTab: restStreamContent
      }
    }),

  resetAll: () =>
    set({
      activeSessionIdByTab: {},
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {},
      activeStreamingContentByTab: {},
      generalPrompt: '',
      memoryPrompt: '',
      characterPrompt: ''
    })
}))
