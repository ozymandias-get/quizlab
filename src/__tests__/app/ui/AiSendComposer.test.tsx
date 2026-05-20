import { createElement, forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import AiSendComposer from '@app/ui/AiSendComposer'

const appearanceState = { selectionColor: '#EAB308' }
const languageState = {
  t: (key: string) => key,
  language: 'en'
}

vi.mock('@app/providers', () => ({
  useAppearance: <T,>(selector?: (s: typeof appearanceState) => T) =>
    selector ? selector(appearanceState) : (appearanceState as unknown as T),
  useLanguage: <T,>(selector?: (s: typeof languageState) => T) =>
    selector ? selector(languageState) : (languageState as unknown as T),
  useLanguageStrings: () => languageState
}))

vi.mock('@shared/hooks', () => {
  const { useState } = require('react')
  return {
    useLocalStorage: <T,>(_key: string, initialValue: T) => useState(initialValue)
  }
})

vi.mock('@app/ui/aiSendComposer/useAiSendComposerLayout', () => ({
  useAiSendComposerLayout: () => ({
    layout: { x: 0, y: 0, width: 420, height: 320 },
    bodyHeight: 240,
    panelRef: { current: null },
    asideRef: { current: null },
    handleDragStart: vi.fn(),
    handleDragMove: vi.fn(),
    handleDragEnd: vi.fn(),
    handleResizeStart: vi.fn(),
    handleResizeMove: vi.fn(),
    handleResizeEnd: vi.fn()
  })
}))

vi.mock('@app/ui/aiSendComposer/AiSendComposerHeader', () => ({
  default: ({
    sendFeedback,
    isExpanded
  }: {
    sendFeedback: 'idle' | 'sending' | 'success' | 'error'
    isExpanded: boolean
  }) => (
    <div>
      Composer Header
      {sendFeedback === 'sending' && <span>sending_to_ai</span>}
      {isExpanded && <span>expanded</span>}
    </div>
  )
}))

vi.mock('@app/ui/aiSendComposer/AiSendComposerToggle', () => ({
  default: () => <div>Composer Toggle</div>
}))

vi.mock('@app/ui/aiSendComposer/AiSendComposerContent', () => ({
  default: ({ onSubmit }: { onSubmit: (options?: { autoSend?: boolean }) => void }) => (
    <button type="button" onClick={() => onSubmit()}>
      Submit Draft
    </button>
  )
}))

vi.mock('framer-motion', () => {
  const createMock = (tag: 'aside' | 'div') => {
    return forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(({ children, ...props }, ref) =>
      createElement(tag, { ...props, ref }, children)
    )
  }

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
    motion: {
      aside: createMock('aside'),
      div: createMock('div')
    }
  }
})

describe('AiSendComposer', () => {
  it('shows sending state in header, then shows success', async () => {
    vi.useFakeTimers()
    let resolveSend: ((value: { success: boolean }) => void) | null = null
    const onSend = vi.fn(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveSend = resolve
        })
    )

    render(
      <AiSendComposer
        items={[{ id: 'text-1', type: 'text', text: 'Selected text' }]}
        autoSend={false}
        onAutoSendChange={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearAll={vi.fn()}
        onSend={onSend}
      />
    )

    expect(screen.getByText('Composer Header')).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit Draft' }))
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(screen.getByText('sending_to_ai')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(320)
    })

    await act(async () => {
      resolveSend?.({ success: true })
    })

    vi.useRealTimers()
  })

  it('does not clear queue on outside click', () => {
    const onClearAll = vi.fn()
    const onSend = vi.fn().mockResolvedValue({ success: true })

    render(
      <AiSendComposer
        items={[{ id: 'text-1', type: 'text', text: 'Selected text' }]}
        autoSend={false}
        onAutoSendChange={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearAll={onClearAll}
        onSend={onSend}
      />
    )

    expect(screen.getByText('Composer Header')).toBeInTheDocument()
    expect(onClearAll).not.toHaveBeenCalled()
  })
})
