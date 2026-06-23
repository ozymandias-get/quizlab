import AiSendComposerHeader from '@app/ui/aiSendComposer/AiSendComposerHeader'

import { render } from '@testing-library/react'
import { describe, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

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
    isSubmitting: false,
    isSendDisabled: false,
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn()
  }

  it('renders without crashing', () => {
    render(<AiSendComposerHeader {...baseProps} />)
  })
})
