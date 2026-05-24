import { create } from 'zustand'
import type { ApiChatMessage } from '@shared-core/types'

export interface ChatSession {
  id: string
  title: string
  messages: ApiChatMessage[]
  createdAt: number
  updatedAt: number
}

const LOCAL_STORAGE_KEY = 'quizlab_api_chat_sessions_v2'

function loadSessionsFromStorage(): ChatSession[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Failed to load api chat sessions', e)
    return []
  }
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.error('Failed to save api chat sessions', e)
  }
}

interface ApiChatStore {
  activeProviderId: string
  selectedModel: string
  generalPrompt: string
  memoryPrompt: string
  characterPrompt: string
  sessions: ChatSession[]
  activeSessionIdByTab: Record<string, string>
  inputValueByTab: Record<string, string>
  messagesByTab: Record<string, ApiChatMessage[]>
  attachmentsByTab: Record<string, string[]>
  selectedModelByTab: Record<string, string>
  activeProviderByTab: Record<string, string>
  isStreamingByTab: Record<string, boolean>

  setActiveProvider: (providerId: string) => void
  setSelectedModel: (model: string) => void
  setGeneralPrompt: (prompt: string) => void
  setMemoryPrompt: (prompt: string) => void
  setCharacterPrompt: (prompt: string) => void
  setConfigFromSettings: (config: {
    generalPrompt: string
    memoryPrompt: string
    characterPrompt: string
    providers: any[]
    selectedProviderId: string
    selectedModel: string
  }) => void

  // Session Actions
  initTabSession: (tabId: string) => void
  createSession: (tabId: string) => void
  selectSession: (tabId: string, sessionId: string) => void
  deleteSession: (tabId: string, sessionId: string) => void
  renameSession: (sessionId: string, title: string) => void

  updateInput: (tabId: string, val: string) => void
  addMessage: (tabId: string, msg: ApiChatMessage) => void
  addAttachment: (tabId: string, data: string) => void
  removeAttachment: (tabId: string, index: number) => void
  setStreaming: (tabId: string, streaming: boolean) => void
  setSelectedModelForTab: (tabId: string, model: string) => void
  setActiveProviderForTab: (tabId: string, providerId: string) => void
  deleteMessage: (tabId: string, messageId: string) => void
  editMessage: (tabId: string, messageId: string, content: string) => void
  clearMessages: (tabId: string) => void
  clearAllSessions: (tabId: string) => void
  regenerateResponse: (tabId: string) => Promise<void>
  editAndRegenerate: (tabId: string, messageId: string, content: string) => Promise<void>
  sendMessage: (
    tabId: string,
    content?: string,
    images?: string[],
    providerId?: string
  ) => Promise<void>
}

export const useApiChatStore = create<ApiChatStore>((set, get) => ({
  activeProviderId: '',
  selectedModel: '',
  generalPrompt: '',
  memoryPrompt: '',
  characterPrompt: '',
  sessions: [],
  activeSessionIdByTab: {},
  inputValueByTab: {},
  messagesByTab: {},
  attachmentsByTab: {},
  selectedModelByTab: {},
  activeProviderByTab: {},
  isStreamingByTab: {},

  setActiveProvider: (providerId) => set({ activeProviderId: providerId }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setGeneralPrompt: (prompt) => set({ generalPrompt: prompt }),
  setMemoryPrompt: (prompt) => set({ memoryPrompt: prompt }),
  setCharacterPrompt: (prompt) => set({ characterPrompt: prompt }),
  setConfigFromSettings: (config) =>
    set({
      generalPrompt: config.generalPrompt || '',
      memoryPrompt: config.memoryPrompt || '',
      characterPrompt: config.characterPrompt || ''
    }),

  initTabSession: (tabId) => {
    let sessions = get().sessions
    if (sessions.length === 0) {
      sessions = loadSessionsFromStorage()
      set({ sessions })
    }

    const activeSessionId = get().activeSessionIdByTab[tabId]
    if (activeSessionId) {
      const activeSession = sessions.find((s) => s.id === activeSessionId)
      if (activeSession) {
        set((s) => ({
          messagesByTab: { ...s.messagesByTab, [tabId]: activeSession.messages }
        }))
        return
      }
    }

    if (sessions.length > 0) {
      // Load the most recent session
      const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
      const mostRecent = sorted[0]
      set((s) => ({
        activeSessionIdByTab: { ...s.activeSessionIdByTab, [tabId]: mostRecent.id },
        messagesByTab: { ...s.messagesByTab, [tabId]: mostRecent.messages }
      }))
    } else {
      // Create a fresh session
      get().createSession(tabId)
    }
  },

  createSession: (tabId) => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: 'Yeni Sohbet',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const updatedSessions = [newSession, ...get().sessions]
    set((s) => ({
      sessions: updatedSessions,
      activeSessionIdByTab: { ...s.activeSessionIdByTab, [tabId]: newSession.id },
      messagesByTab: { ...s.messagesByTab, [tabId]: [] },
      inputValueByTab: { ...s.inputValueByTab, [tabId]: '' },
      attachmentsByTab: { ...s.attachmentsByTab, [tabId]: [] }
    }))

    saveSessionsToStorage(updatedSessions)
  },

  selectSession: (tabId, sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId)
    if (!session) return

    set((s) => ({
      activeSessionIdByTab: { ...s.activeSessionIdByTab, [tabId]: sessionId },
      messagesByTab: { ...s.messagesByTab, [tabId]: session.messages }
    }))
  },

  deleteSession: (_tabId, sessionId) => {
    let filteredSessions = get().sessions.filter((s) => s.id !== sessionId)

    if (filteredSessions.length === 0) {
      const newSession: ChatSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: 'Yeni Sohbet',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      filteredSessions = [newSession]
    }

    set({ sessions: filteredSessions })
    saveSessionsToStorage(filteredSessions)

    const activeSessionIdByTab = { ...get().activeSessionIdByTab }
    const messagesByTab = { ...get().messagesByTab }

    Object.entries(activeSessionIdByTab).forEach(([tId, activeId]) => {
      if (activeId === sessionId || !filteredSessions.some((s) => s.id === activeId)) {
        const sorted = [...filteredSessions].sort((a, b) => b.updatedAt - a.updatedAt)
        const fallback = sorted[0]
        activeSessionIdByTab[tId] = fallback.id
        messagesByTab[tId] = fallback.messages
      }
    })

    set({ activeSessionIdByTab, messagesByTab })
  },

  renameSession: (sessionId, title) => {
    const updatedSessions = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, title: title.trim() || 'Yeni Sohbet', updatedAt: Date.now() } : s
    )
    set({ sessions: updatedSessions })
    saveSessionsToStorage(updatedSessions)

    // Sync active messagesByTab for tabs that have this session active
    const activeSessionIdByTab = get().activeSessionIdByTab
    const messagesByTab = { ...get().messagesByTab }

    let needsUpdate = false
    Object.entries(activeSessionIdByTab).forEach(([tId, activeId]) => {
      if (activeId === sessionId) {
        const session = updatedSessions.find((s) => s.id === sessionId)
        if (session) {
          messagesByTab[tId] = session.messages
          needsUpdate = true
        }
      }
    })

    if (needsUpdate) {
      set({ messagesByTab })
    }
  },

  updateInput: (tabId, val) =>
    set((s) => ({ inputValueByTab: { ...s.inputValueByTab, [tabId]: val } })),

  addMessage: (tabId, msg) => {
    const activeSessionId = get().activeSessionIdByTab[tabId]
    if (!activeSessionId) return

    const sessions = get().sessions
    const updatedSessions = sessions.map((session) => {
      if (session.id === activeSessionId) {
        // Auto-generate title on the first user message
        let title = session.title
        if (session.title === 'Yeni Sohbet' && msg.role === 'user') {
          title = msg.content.slice(0, 30).trim() + (msg.content.length > 30 ? '...' : '')
        }
        return {
          ...session,
          title,
          messages: [...session.messages, msg],
          updatedAt: Date.now()
        }
      }
      return session
    })

    set((s) => ({
      sessions: updatedSessions,
      messagesByTab: {
        ...s.messagesByTab,
        [tabId]: [...(s.messagesByTab[tabId] || []), msg]
      }
    }))

    saveSessionsToStorage(updatedSessions)
  },

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

  setStreaming: (tabId, streaming) =>
    set((s) => ({
      isStreamingByTab: { ...s.isStreamingByTab, [tabId]: streaming }
    })),

  setSelectedModelForTab: (tabId, model) =>
    set((s) => ({
      selectedModelByTab: { ...s.selectedModelByTab, [tabId]: model }
    })),

  setActiveProviderForTab: (tabId, providerId) =>
    set((s) => ({
      activeProviderByTab: { ...s.activeProviderByTab, [tabId]: providerId }
    })),

  clearMessages: (tabId) => {
    const activeSessionId = get().activeSessionIdByTab[tabId]
    if (!activeSessionId) return

    const updatedSessions = get().sessions.map((s) =>
      s.id === activeSessionId
        ? { ...s, messages: [], title: 'Yeni Sohbet', updatedAt: Date.now() }
        : s
    )

    set((s) => ({
      sessions: updatedSessions,
      messagesByTab: { ...s.messagesByTab, [tabId]: [] }
    }))

    saveSessionsToStorage(updatedSessions)
  },

  clearAllSessions: (tabId) => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: 'Yeni Sohbet',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const updatedSessions = [newSession]
    const activeSessionIdByTab = { ...get().activeSessionIdByTab }
    const messagesByTab = { ...get().messagesByTab }

    Object.keys(activeSessionIdByTab).forEach((tId) => {
      activeSessionIdByTab[tId] = newSession.id
      messagesByTab[tId] = []
    })

    activeSessionIdByTab[tabId] = newSession.id
    messagesByTab[tabId] = []

    set({
      sessions: updatedSessions,
      activeSessionIdByTab,
      messagesByTab,
      inputValueByTab: {},
      attachmentsByTab: {}
    })

    saveSessionsToStorage(updatedSessions)
  },

  deleteMessage: (tabId, messageId) => {
    const activeSessionId = get().activeSessionIdByTab[tabId]
    if (!activeSessionId) return

    const updatedSessions = get().sessions.map((s) =>
      s.id === activeSessionId
        ? {
            ...s,
            messages: s.messages.filter((m) => m.id !== messageId),
            updatedAt: Date.now()
          }
        : s
    )

    set((s) => ({
      sessions: updatedSessions,
      messagesByTab: {
        ...s.messagesByTab,
        [tabId]: (s.messagesByTab[tabId] || []).filter((m) => m.id !== messageId)
      }
    }))

    saveSessionsToStorage(updatedSessions)
  },

  editMessage: (tabId, messageId, content) => {
    const activeSessionId = get().activeSessionIdByTab[tabId]
    if (!activeSessionId) return

    const updatedSessions = get().sessions.map((s) =>
      s.id === activeSessionId
        ? {
            ...s,
            messages: s.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
            updatedAt: Date.now()
          }
        : s
    )

    set((s) => ({
      sessions: updatedSessions,
      messagesByTab: {
        ...s.messagesByTab,
        [tabId]: (s.messagesByTab[tabId] || []).map((m) =>
          m.id === messageId ? { ...m, content } : m
        )
      }
    }))

    saveSessionsToStorage(updatedSessions)
  },

  regenerateResponse: async (tabId) => {
    if (get().isStreamingByTab[tabId]) return
    let currentMessages = [...(get().messagesByTab[tabId] || [])]
    if (currentMessages.length === 0) return

    // If the last message is from assistant or an error, remove it
    if (currentMessages[currentMessages.length - 1].role === 'assistant') {
      currentMessages.pop()
    }

    const activeSessionId = get().activeSessionIdByTab[tabId]
    if (!activeSessionId) return

    const sessions = get().sessions
    const updatedSessions = sessions.map((session) => {
      if (session.id === activeSessionId) {
        return {
          ...session,
          messages: currentMessages,
          updatedAt: Date.now()
        }
      }
      return session
    })

    set((s) => ({
      sessions: updatedSessions,
      messagesByTab: {
        ...s.messagesByTab,
        [tabId]: currentMessages
      }
    }))
    saveSessionsToStorage(updatedSessions)

    get().setStreaming(tabId, true)
    try {
      const model = get().selectedModelByTab[tabId] || get().selectedModel
      const pid = get().activeProviderByTab[tabId] || get().activeProviderId
      const api = (window as any).electronAPI
      if (!api?.sendApiChatRequest) {
        throw new Error('API Chat not available in this environment')
      }
      const combinedPrompt = [
        get().memoryPrompt && `[User Info]\n${get().memoryPrompt}`,
        get().characterPrompt && `[Character]\n${get().characterPrompt}`,
        get().generalPrompt && `[System]\n${get().generalPrompt}`
      ]
        .filter(Boolean)
        .join('\n\n')

      const reply = await api.sendApiChatRequest(
        currentMessages,
        model || undefined,
        combinedPrompt || undefined,
        pid || undefined
      )
      get().addMessage(tabId, reply)
    } catch (err: any) {
      get().addMessage(tabId, {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `Hata: ${err.message || 'İstek başarısız oldu'}`,
        timestamp: Date.now()
      })
    } finally {
      get().setStreaming(tabId, false)
    }
  },

  editAndRegenerate: async (tabId, messageId, content) => {
    const activeSessionId = get().activeSessionIdByTab[tabId]
    if (!activeSessionId) return

    const currentMessages = get().messagesByTab[tabId] || []
    const index = currentMessages.findIndex((m) => m.id === messageId)
    if (index === -1) return

    // Truncate up to index and update content
    const truncated = currentMessages.slice(0, index + 1)
    truncated[index] = { ...truncated[index], content, timestamp: Date.now() }

    const updatedSessions = get().sessions.map((s) =>
      s.id === activeSessionId
        ? {
            ...s,
            messages: truncated,
            updatedAt: Date.now()
          }
        : s
    )

    set((s) => ({
      sessions: updatedSessions,
      messagesByTab: {
        ...s.messagesByTab,
        [tabId]: truncated
      }
    }))
    saveSessionsToStorage(updatedSessions)

    // Trigger regeneration
    await get().regenerateResponse(tabId)
  },

  sendMessage: async (tabId, content, images, providerId) => {
    const state = get()
    if (state.isStreamingByTab[tabId]) return
    const activeSessionId = state.activeSessionIdByTab[tabId]
    if (!activeSessionId) return

    const text = content !== undefined ? content : state.inputValueByTab[tabId] || ''
    const imgs = images || state.attachmentsByTab[tabId] || []
    const model = state.selectedModelByTab[tabId] || state.selectedModel
    const pid = providerId || state.activeProviderByTab[tabId] || state.activeProviderId

    if (!text && imgs.length === 0) return

    const userMsg: ApiChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      providerId: pid,
      images: imgs.length > 0 ? imgs : undefined
    }

    get().addMessage(tabId, userMsg)
    get().updateInput(tabId, '')
    get().setStreaming(tabId, true)

    if (imgs.length > 0) {
      set((s) => ({
        attachmentsByTab: { ...s.attachmentsByTab, [tabId]: [] }
      }))
    }

    try {
      const currentMessages = get().messagesByTab[tabId] || []
      const api = (window as any).electronAPI
      if (!api?.sendApiChatRequest) {
        throw new Error('API Chat not available in this environment')
      }
      const combinedPrompt = [
        state.memoryPrompt && `[User Info]\n${state.memoryPrompt}`,
        state.characterPrompt && `[Character]\n${state.characterPrompt}`,
        state.generalPrompt && `[System]\n${state.generalPrompt}`
      ]
        .filter(Boolean)
        .join('\n\n')

      const reply = await api.sendApiChatRequest(
        currentMessages,
        model || undefined,
        combinedPrompt || undefined,
        pid || undefined
      )
      get().addMessage(tabId, reply)
    } catch (err: any) {
      get().addMessage(tabId, {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `Hata: ${err.message || 'İstek başarısız oldu'}`,
        timestamp: Date.now()
      })
    } finally {
      get().setStreaming(tabId, false)
    }
  }
}))
