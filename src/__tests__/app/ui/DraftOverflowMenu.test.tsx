import DraftOverflowMenu from '@app/ui/aiSendComposer/DraftOverflowMenu'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const mockConfirm = vi.fn()

vi.mock('@shared/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: mockConfirm, props: {} })
}))

vi.mock('@app/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null
}))

describe('DraftOverflowMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('moves focus to the menu item and returns it to the trigger on Escape', () => {
    render(<DraftOverflowMenu onClearAll={vi.fn()} totalItems={2} />)

    const trigger = screen.getByTestId('ai-draft-overflow')
    fireEvent.click(trigger)

    const item = screen.getByTestId('ai-draft-clear-all')
    expect(item).toHaveFocus()

    fireEvent.keyDown(item, { key: 'Escape' })

    expect(screen.queryByTestId('ai-draft-overflow-menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps the menu open when a click lands inside it', () => {
    render(<DraftOverflowMenu onClearAll={vi.fn()} totalItems={2} />)

    fireEvent.click(screen.getByTestId('ai-draft-overflow'))
    fireEvent.pointerDown(screen.getByTestId('ai-draft-overflow-menu'))

    expect(screen.getByTestId('ai-draft-overflow-menu')).toBeInTheDocument()
  })
})
