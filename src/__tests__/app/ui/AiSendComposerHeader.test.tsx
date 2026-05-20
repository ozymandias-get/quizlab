import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AiSendComposerHeader from '@app/ui/aiSendComposer/AiSendComposerHeader'

vi.mock('@app/providers', () => ({
  useLanguage: () => ({
    t: (key: string) => key
  }),
  useLanguageStrings: () => ({ t: (key: string) => key, language: 'en' })
}))

describe('AiSendComposerHeader', () => {
  const baseProps = {
    textCount: 1,
    imageCount: 0,
    autoSend: false,
    isExpanded: true,
    sendFeedback: 'idle' as const,
    onToggleAutoSend: vi.fn(),
    onToggleExpand: vi.fn(),
    onClearAll: vi.fn(),
    onSend: vi.fn(),
    isSubmitting: false,
    isSendDisabled: false,
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn()
  }

  it('renders an auto send button and forwards toggle clicks', () => {
    const onToggleAutoSend = vi.fn()

    render(<AiSendComposerHeader {...baseProps} onToggleAutoSend={onToggleAutoSend} />)

    const toggleButton = screen.getByRole('button', { name: /auto_send/i })
    expect(toggleButton).toBeInTheDocument()

    fireEvent.click(toggleButton)
    expect(onToggleAutoSend).toHaveBeenCalledTimes(1)
  })

  it('shows send button when collapsed', () => {
    render(<AiSendComposerHeader {...baseProps} isExpanded={false} />)

    expect(screen.getByRole('button', { name: /send_to_ai/i })).toBeInTheDocument()
  })

  it('hides send button when expanded', () => {
    render(<AiSendComposerHeader {...baseProps} isExpanded />)

    expect(screen.queryByRole('button', { name: /send_to_ai/i })).not.toBeInTheDocument()
  })

  it('disables send button when items are empty', () => {
    render(<AiSendComposerHeader {...baseProps} isExpanded={false} isSendDisabled />)

    const sendButton = screen.getByRole('button', { name: /send_to_ai/i })
    expect(sendButton).toBeDisabled()
  })
})
