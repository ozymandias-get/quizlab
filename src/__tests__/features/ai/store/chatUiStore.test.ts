/**
 * Tests for chatUiStore — the Zustand UI-only store for AI Chat.
 *
 * This store replaces the UI state portion of the legacy apiChatStore.
 * It manages per-tab state: active session, input, attachments,
 * streaming flags, selected model, and provider preferences.
 *
 * Server/data state (sessions, messages) is managed by TanStack Query hooks:
 *   - useSessionsQuery
 *   - useMessagesQuery
 *   - useSendMessageMutation (et al.)
 *
 * @see @features/ai/store/chatUiStore
 * @see @features/ai/queries/useSessionsQuery
 * @see @features/ai/queries/useMessagesQuery
 */

import { useChatUiStore } from '@features/ai/store/chatUiStore'

import { beforeEach, describe, expect, it } from 'vitest'

const resetStore = () => {
  useChatUiStore.setState({
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
}

describe('chatUiStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('setActiveSessionId', () => {
    it('sets the active session id for a tab', () => {
      useChatUiStore.getState().setActiveSessionId('tab1', 'session-1')
      expect(useChatUiStore.getState().activeSessionIdByTab.tab1).toBe('session-1')
    })

    it('updates session id for existing tab', () => {
      useChatUiStore.getState().setActiveSessionId('tab1', 'session-1')
      useChatUiStore.getState().setActiveSessionId('tab1', 'session-2')
      expect(useChatUiStore.getState().activeSessionIdByTab.tab1).toBe('session-2')
    })

    it('preserves other tabs when setting a new tab', () => {
      useChatUiStore.getState().setActiveSessionId('tab1', 's1')
      useChatUiStore.getState().setActiveSessionId('tab2', 's2')
      expect(useChatUiStore.getState().activeSessionIdByTab.tab1).toBe('s1')
      expect(useChatUiStore.getState().activeSessionIdByTab.tab2).toBe('s2')
    })
  })

  describe('updateInput', () => {
    it('sets the input value for a tab', () => {
      useChatUiStore.getState().updateInput('tab1', 'hello')
      expect(useChatUiStore.getState().inputValueByTab.tab1).toBe('hello')
    })

    it('overwrites previous input value', () => {
      useChatUiStore.getState().updateInput('tab1', 'first')
      useChatUiStore.getState().updateInput('tab1', 'second')
      expect(useChatUiStore.getState().inputValueByTab.tab1).toBe('second')
    })
  })

  describe('attachments', () => {
    it('adds an attachment to a tab', () => {
      useChatUiStore.getState().addAttachment('tab1', 'data:image/png;base64,abc')
      expect(useChatUiStore.getState().attachmentsByTab.tab1).toEqual(['data:image/png;base64,abc'])
    })

    it('appends multiple attachments', () => {
      useChatUiStore.getState().addAttachment('tab1', 'img1')
      useChatUiStore.getState().addAttachment('tab1', 'img2')
      expect(useChatUiStore.getState().attachmentsByTab.tab1).toHaveLength(2)
    })

    it('removes an attachment by index', () => {
      useChatUiStore.getState().addAttachment('tab1', 'img1')
      useChatUiStore.getState().addAttachment('tab1', 'img2')
      useChatUiStore.getState().removeAttachment('tab1', 0)
      expect(useChatUiStore.getState().attachmentsByTab.tab1).toEqual(['img2'])
    })

    it('clears all attachments for a tab', () => {
      useChatUiStore.getState().addAttachment('tab1', 'img1')
      useChatUiStore.getState().addAttachment('tab1', 'img2')
      useChatUiStore.getState().clearAttachments('tab1')
      expect(useChatUiStore.getState().attachmentsByTab.tab1).toEqual([])
    })
  })

  describe('streaming state (hybrid architecture)', () => {
    it('sets streaming flag for a tab', () => {
      useChatUiStore.getState().setStreaming('tab1', true)
      expect(useChatUiStore.getState().isStreamingByTab.tab1).toBe(true)
    })

    it('unsets streaming flag for a tab', () => {
      useChatUiStore.getState().setStreaming('tab1', true)
      useChatUiStore.getState().setStreaming('tab1', false)
      expect(useChatUiStore.getState().isStreamingByTab.tab1).toBe(false)
    })

    it('preserves streaming state across different tabs', () => {
      useChatUiStore.getState().setStreaming('tab1', true)
      useChatUiStore.getState().setStreaming('tab2', false)
      expect(useChatUiStore.getState().isStreamingByTab.tab1).toBe(true)
      expect(useChatUiStore.getState().isStreamingByTab.tab2).toBe(false)
    })

    it('appends streaming content', () => {
      useChatUiStore.getState().appendStreamingContent('tab1', 'Hello')
      useChatUiStore.getState().appendStreamingContent('tab1', ' World')
      expect(useChatUiStore.getState().activeStreamingContentByTab.tab1).toBe('Hello World')
    })

    it('clears streaming content for a tab', () => {
      useChatUiStore.getState().appendStreamingContent('tab1', 'Hello')
      useChatUiStore.getState().clearStreamingContent('tab1')
      expect(useChatUiStore.getState().activeStreamingContentByTab.tab1).toBe('')
    })

    it('clears streaming content when streaming ends', () => {
      // Simulates the mutation cleanup in useSendMessageMutation:
      // 1. Streaming starts
      useChatUiStore.getState().setStreaming('tab1', true)
      useChatUiStore.getState().appendStreamingContent('tab1', 'partial response')
      expect(useChatUiStore.getState().isStreamingByTab.tab1).toBe(true)
      expect(useChatUiStore.getState().activeStreamingContentByTab.tab1).toBe('partial response')

      // 2. Streaming ends (mutation completes) — both flag and content are cleaned up
      useChatUiStore.getState().setStreaming('tab1', false)
      useChatUiStore.getState().clearStreamingContent('tab1')
      expect(useChatUiStore.getState().isStreamingByTab.tab1).toBe(false)
      expect(useChatUiStore.getState().activeStreamingContentByTab.tab1).toBe('')
    })
  })

  describe('model and provider selection', () => {
    it('sets selected model for a tab', () => {
      useChatUiStore.getState().setSelectedModel('tab1', 'gpt-4o')
      expect(useChatUiStore.getState().selectedModelByTab.tab1).toBe('gpt-4o')
    })

    it('sets active provider for a tab', () => {
      useChatUiStore.getState().setActiveProvider('tab1', 'openai')
      expect(useChatUiStore.getState().activeProviderByTab.tab1).toBe('openai')
    })
  })

  describe('setConfigPrompts', () => {
    it('sets all three prompt values', () => {
      useChatUiStore.getState().setConfigPrompts({
        generalPrompt: 'general',
        memoryPrompt: 'memory',
        characterPrompt: 'character'
      })
      const state = useChatUiStore.getState()
      expect(state.generalPrompt).toBe('general')
      expect(state.memoryPrompt).toBe('memory')
      expect(state.characterPrompt).toBe('character')
    })

    it('overwrites previous prompt values', () => {
      useChatUiStore.getState().setConfigPrompts({
        generalPrompt: 'old',
        memoryPrompt: 'old',
        characterPrompt: 'old'
      })
      useChatUiStore.getState().setConfigPrompts({
        generalPrompt: 'new',
        memoryPrompt: 'new',
        characterPrompt: 'new'
      })
      const state = useChatUiStore.getState()
      expect(state.generalPrompt).toBe('new')
      expect(state.memoryPrompt).toBe('new')
      expect(state.characterPrompt).toBe('new')
    })
  })

  describe('resetTabState', () => {
    it('removes all state for a specific tab', () => {
      useChatUiStore.getState().setActiveSessionId('tab1', 's1')
      useChatUiStore.getState().updateInput('tab1', 'text')
      useChatUiStore.getState().addAttachment('tab1', 'img')
      useChatUiStore.getState().setSelectedModel('tab1', 'gpt-4o')
      useChatUiStore.getState().setActiveProvider('tab1', 'openai')
      useChatUiStore.getState().setStreaming('tab1', true)
      useChatUiStore.getState().appendStreamingContent('tab1', 'content')

      // Add state for another tab to verify isolation
      useChatUiStore.getState().setActiveSessionId('tab2', 's2')

      useChatUiStore.getState().resetTabState('tab1')

      const state = useChatUiStore.getState()
      // tab1 state is cleared
      expect(state.activeSessionIdByTab.tab1).toBeUndefined()
      expect(state.inputValueByTab.tab1).toBeUndefined()
      expect(state.attachmentsByTab.tab1).toBeUndefined()
      expect(state.selectedModelByTab.tab1).toBeUndefined()
      expect(state.activeProviderByTab.tab1).toBeUndefined()
      expect(state.isStreamingByTab.tab1).toBeUndefined()
      expect(state.activeStreamingContentByTab.tab1).toBeUndefined()
      // tab2 state is preserved
      expect(state.activeSessionIdByTab.tab2).toBe('s2')
    })
  })

  describe('resetAll', () => {
    it('clears all state including prompts', () => {
      useChatUiStore.getState().setActiveSessionId('tab1', 's1')
      useChatUiStore.getState().updateInput('tab1', 'text')
      useChatUiStore.getState().setConfigPrompts({
        generalPrompt: 'g',
        memoryPrompt: 'm',
        characterPrompt: 'c'
      })

      useChatUiStore.getState().resetAll()

      const state = useChatUiStore.getState()
      expect(state.activeSessionIdByTab).toEqual({})
      expect(state.inputValueByTab).toEqual({})
      expect(state.attachmentsByTab).toEqual({})
      expect(state.selectedModelByTab).toEqual({})
      expect(state.activeProviderByTab).toEqual({})
      expect(state.isStreamingByTab).toEqual({})
      expect(state.activeStreamingContentByTab).toEqual({})
      expect(state.generalPrompt).toBe('')
      expect(state.memoryPrompt).toBe('')
      expect(state.characterPrompt).toBe('')
    })
  })
})
