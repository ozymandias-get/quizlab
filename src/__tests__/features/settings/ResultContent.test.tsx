import ResultContent from '@features/settings/ui/siteSessions/components/wizard/ResultContent'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('ResultContent', () => {
  it('wraps a long unbroken error instead of overflowing the panel', () => {
    const error = `install failed at C:\\Users\\someone\\${'a'.repeat(200)}\\extension`
    render(
      <ResultContent
        success={false}
        error={error}
        mode="install"
        isConnected={false}
        installedPath={null}
        copied={false}
        copiedLink={false}
        onCopyPath={vi.fn()}
        onCopyLink={vi.fn()}
        onRetry={vi.fn()}
        onDone={vi.fn()}
        statusIndicator={null}
      />
    )

    const message = screen.getByText(error)
    expect(message.className).toContain('break-words')
    expect(message.className).toContain('[overflow-wrap:anywhere]')
  })
})
