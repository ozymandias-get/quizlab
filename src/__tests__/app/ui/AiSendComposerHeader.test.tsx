import AiSendComposerHeader from '@app/ui/aiSendComposer/AiSendComposerHeader'
import { TooltipProvider } from '@app/components/ui/tooltip'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

function renderWithTooltip(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('AiSendComposerHeader', () => {
  const baseProps = {
    textCount: 1,
    imageCount: 0,
    autoSend: false,
    isExpanded: true,
    sendFeedback: 'idle' as const,
    onToggleExpand: vi.fn(),
    onClearAll: vi.fn(),
    onSend: vi.fn(),
    onSendWithPreset: vi.fn(),
    isSubmitting: false,
    isSendDisabled: false,
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn(),
    onDragLostCapture: vi.fn()
  }

  it('renders without crashing in expanded mode', () => {
    renderWithTooltip(<AiSendComposerHeader {...baseProps} />)
  })

  it('renders quick action buttons in compact mode and triggers onSendWithPreset', () => {
    const onSendWithPreset = vi.fn()
    renderWithTooltip(
      <AiSendComposerHeader {...baseProps} isExpanded={false} onSendWithPreset={onSendWithPreset} />
    )

    const explainButton = screen.getByRole('button', { name: /ai_preset_explain/i })
    expect(explainButton).toBeInTheDocument()
    fireEvent.click(explainButton)
    expect(onSendWithPreset).toHaveBeenCalledWith('ai_preset_explain_value')

    const quizButton = screen.getByRole('button', { name: /ai_preset_quiz/i })
    expect(quizButton).toBeInTheDocument()
    fireEvent.click(quizButton)
    expect(onSendWithPreset).toHaveBeenCalledWith('ai_preset_quiz_value')
  })

  it('renders sending state when sendFeedback is sending in compact mode', () => {
    renderWithTooltip(
      <AiSendComposerHeader {...baseProps} isExpanded={false} sendFeedback="sending" />
    )
    expect(screen.getByText('sending_to_ai')).toBeInTheDocument()
  })
})
