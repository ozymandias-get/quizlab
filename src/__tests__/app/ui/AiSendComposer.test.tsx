import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import AiSendComposer from '@app/ui/AiSendComposer'

vi.mock('@app/providers', () => ({
  useAppearance: () => ({
    selectionColor: '#EAB308'
  }),
  useLanguage: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@app/ui/aiSendComposer/useAiSendComposerLayout', () => ({
  useAiSendComposerLayout: () => ({
    layout: { x: 0, y: 0, width: 420, height: 320 },
    bodyHeight: 240,
    panelRef: { current: null },
    handleDragStart: vi.fn(),
    handleDragMove: vi.fn(),
    handleDragEnd: vi.fn(),
    handleResizeStart: vi.fn(),
    handleResizeMove: vi.fn(),
    handleResizeEnd: vi.fn()
  })
}))

vi.mock('@app/ui/aiSendComposer/AiSendComposerHeader', () => ({
  default: () => <div>Composer Header</div>
}))

vi.mock('@app/ui/aiSendComposer/AiSendComposerToggle', () => ({
  default: () => <div>Composer Toggle</div>
}))

vi.mock('@app/ui/aiSendComposer/AiSendComposerContent', () => ({
  default: ({
    onSubmit,
    isSubmitting
  }: {
    onSubmit: (options?: { autoSend?: boolean }) => void
    isSubmitting: boolean
  }) => (
    <button type="button" onClick={() => onSubmit()}>
      {isSubmitting ? 'sending_to_ai' : 'Submit Draft'}
    </button>
  )
}))

vi.mock('framer-motion', () => {
  const createMock = (tag: keyof React.JSX.IntrinsicElements) => {
    return React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
      ({ children, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)
    )
  }

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      aside: createMock('aside'),
      div: createMock('div')
    }
  }
})

describe('AiSendComposer', () => {
  it('shows sending state briefly, then dismisses without waiting for the promise', async () => {
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
    expect(screen.getAllByText('sending_to_ai').length).toBeGreaterThan(0)
    expect(screen.getByText('Composer Header')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(320)
    })

    expect(screen.queryByText('Composer Header')).not.toBeInTheDocument()

    await act(async () => {
      resolveSend?.({ success: true })
    })

    vi.useRealTimers()
  })
})
