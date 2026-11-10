import type { ApiChatMessage } from '@shared-core/types'

import MessageBubble from '@features/ai/ui/chat/MessageBubble'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@features/ai/lib/parseMessageContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>
}))
vi.mock('@features/ai/ui/chat/Avatars', () => ({
  Timestamp: () => <span>timestamp</span>
}))
vi.mock('@features/ai/ui/chat/MessageActions', () => ({
  CopyButton: () => null,
  DeleteButton: () => null,
  FeedbackButtons: () => null,
  TtsButton: () => null
}))

const IMAGE = 'data:image/png;base64,iVBORw0KGgo='

function createMessage(): ApiChatMessage {
  return {
    id: 'message-1',
    role: 'assistant',
    content: 'hello',
    timestamp: Date.UTC(2026, 0, 1, 12),
    images: [IMAGE]
  }
}

function renderBubble() {
  render(<MessageBubble message={createMessage()} isUser={false} onDelete={vi.fn()} />)
}

describe('MessageBubble', () => {
  it('opens the image preview as a modal dialog and restores focus on Escape', async () => {
    renderBubble()
    const thumbnail = screen.getByRole('button', { name: 'Open image' })
    thumbnail.focus()
    fireEvent.click(thumbnail)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.parentElement).toBe(document.body)
    const closeButton = screen.getByRole('button', { name: 'Close image' })
    await waitFor(() => expect(closeButton).toHaveFocus())
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(thumbnail).toHaveFocus()
  })

  it('closes from the backdrop but not from the image itself', () => {
    renderBubble()
    const thumbnail = screen.getByRole('button', { name: 'Open image' })

    fireEvent.click(thumbnail)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog.querySelector('img') as HTMLImageElement)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(dialog)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not paint prose starting with "Error:" as an error bubble', () => {
    const { container } = render(
      <MessageBubble
        message={{
          ...createMessage(),
          images: [],
          content: 'Error: this sentence explains a failure mode.'
        }}
        isUser={false}
        onDelete={vi.fn()}
      />
    )

    expect(container.querySelector('[data-message-error]')).toBeNull()
  })

  it('paints an explicit system error as an error bubble', () => {
    const { container } = render(
      <MessageBubble
        message={{ ...createMessage(), images: [], content: 'Request failed', isError: true }}
        isUser={false}
        onDelete={vi.fn()}
      />
    )

    expect(container.querySelector('[data-message-error="true"]')).not.toBeNull()
  })
})
