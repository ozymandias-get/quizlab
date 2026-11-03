import DraftOverflowMenu from '@app/ui/aiSendComposer/DraftOverflowMenu'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    render(<DraftOverflowMenu onClearAll={vi.fn()} totalItems={2} itemIds={['a', 'b']} />)

    const trigger = screen.getByTestId('ai-draft-overflow')
    fireEvent.click(trigger)

    const item = screen.getByTestId('ai-draft-clear-all')
    expect(item).toHaveFocus()

    fireEvent.keyDown(item, { key: 'Escape' })

    expect(screen.queryByTestId('ai-draft-overflow-menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps the menu open when a click lands inside it', () => {
    render(<DraftOverflowMenu onClearAll={vi.fn()} totalItems={2} itemIds={['a', 'b']} />)

    fireEvent.click(screen.getByTestId('ai-draft-overflow'))
    fireEvent.pointerDown(screen.getByTestId('ai-draft-overflow-menu'))

    expect(screen.getByTestId('ai-draft-overflow-menu')).toBeInTheDocument()
  })

  it('handles Escape in one layer and does not leak it to the surrounding dialog', () => {
    const documentKeyDown = vi.fn()
    document.addEventListener('keydown', documentKeyDown)

    render(<DraftOverflowMenu onClearAll={vi.fn()} totalItems={2} itemIds={['a', 'b']} />)
    fireEvent.click(screen.getByTestId('ai-draft-overflow'))

    const item = screen.getByTestId('ai-draft-clear-all')
    fireEvent.keyDown(item, { key: 'Escape' })

    expect(screen.queryByTestId('ai-draft-overflow-menu')).not.toBeInTheDocument()
    // The menu's handler stops the native event, so document listeners (the
    // parent dialog's Escape handling) never see it.
    expect(documentKeyDown).not.toHaveBeenCalled()

    document.removeEventListener('keydown', documentKeyDown)
  })

  it('asks again instead of deleting drafts added while the dialog was open', async () => {
    const onClearAll = vi.fn()
    let resolveFirstConfirm: (value: boolean) => void = () => undefined
    mockConfirm
      .mockReturnValueOnce(
        new Promise<boolean>((resolve) => {
          resolveFirstConfirm = resolve
        })
      )
      .mockResolvedValueOnce(true)

    const { rerender } = render(
      <DraftOverflowMenu onClearAll={onClearAll} totalItems={1} itemIds={['a']} />
    )

    fireEvent.click(screen.getByTestId('ai-draft-overflow'))
    fireEvent.click(screen.getByTestId('ai-draft-clear-all'))

    // A draft is added while the confirmation is still open.
    rerender(<DraftOverflowMenu onClearAll={onClearAll} totalItems={2} itemIds={['a', 'b']} />)

    await act(async () => {
      resolveFirstConfirm(true)
    })

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2))
    expect(mockConfirm.mock.calls[1][0]).toMatchObject({
      description: 'ai_send_clear_all_confirm'
    })
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('clears immediately when the queue is unchanged', async () => {
    const onClearAll = vi.fn()
    mockConfirm.mockResolvedValueOnce(true)

    render(<DraftOverflowMenu onClearAll={onClearAll} totalItems={2} itemIds={['a', 'b']} />)

    fireEvent.click(screen.getByTestId('ai-draft-overflow'))
    fireEvent.click(screen.getByTestId('ai-draft-clear-all'))

    await waitFor(() => expect(onClearAll).toHaveBeenCalledTimes(1))
    expect(mockConfirm).toHaveBeenCalledTimes(1)
  })
})
