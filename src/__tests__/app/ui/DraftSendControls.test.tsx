import DraftSendControls from '@app/ui/aiSendComposer/DraftSendControls'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const baseProps = {
  autoSend: false,
  onToggleAutoSend: vi.fn(),
  onRetry: vi.fn(),
  onDismiss: vi.fn(),
  isSubmitting: false,
  isResendSafe: false
}

describe('DraftSendControls', () => {
  it('lets the status line wrap instead of squeezing the failure reason out', () => {
    render(<DraftSendControls {...baseProps} feedback="error" isResendSafe />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('ai_send_error')
    // Retry and dismiss refuse to shrink; the status has to be able to take a
    // line of its own once the panel is narrower than 24rem.
    expect(status.parentElement).toHaveClass('flex-wrap')
    expect(status).toHaveClass('@max-[24rem]:w-full')
    expect(screen.getByRole('button', { name: 'ai_send_retry' })).toBeInTheDocument()
  })

  it('keeps the dismiss action and the incomplete status visible together', () => {
    render(<DraftSendControls {...baseProps} feedback="incomplete" />)

    expect(screen.getByRole('status')).toHaveTextContent('ai_send_awaiting_submit')
    expect(screen.getByRole('button', { name: 'ai_send_dismiss' })).toBeInTheDocument()
    // Partial delivery must never offer an automatic resend.
    expect(screen.queryByRole('button', { name: 'ai_send_retry' })).not.toBeInTheDocument()
  })

  it('shows sending feedback without a retry action', () => {
    render(<DraftSendControls {...baseProps} feedback="sending" isSubmitting isResendSafe />)

    expect(screen.getByRole('status')).toHaveTextContent('sending_to_ai')
    expect(screen.queryByRole('button', { name: 'ai_send_retry' })).not.toBeInTheDocument()
  })

  it('keeps the auto-send switch labelled by its state and disabled while sending', () => {
    const { rerender } = render(<DraftSendControls {...baseProps} feedback="idle" autoSend />)

    expect(screen.getByRole('switch', { name: 'auto_send_on' })).toBeEnabled()

    rerender(<DraftSendControls {...baseProps} feedback="idle" isSubmitting />)
    expect(screen.getByRole('switch', { name: 'auto_send_off' })).toBeDisabled()
  })

  it('hides a dismissed outcome but leaves the live region rendered only when meaningful', () => {
    const { rerender } = render(
      <DraftSendControls {...baseProps} feedback="incomplete" showOutcome={false} />
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ai_send_dismiss' })).not.toBeInTheDocument()

    rerender(<DraftSendControls {...baseProps} feedback="incomplete" />)
    expect(screen.getByRole('status')).toHaveTextContent('ai_send_awaiting_submit')
  })
})
