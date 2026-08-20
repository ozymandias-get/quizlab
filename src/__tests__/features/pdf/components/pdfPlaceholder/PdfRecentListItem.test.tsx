import PdfRecentListItem from '@features/pdf/ui/components/pdfPlaceholder/PdfRecentListItem'
import type { RecentItemView } from '@features/pdf/ui/components/pdfPlaceholder/types'
import { TooltipProvider } from '@app/components/ui/tooltip'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

function makeItem(overrides: Partial<RecentItemView> = {}): RecentItemView {
  return {
    name: 'Math Book.pdf',
    path: '/path/math.pdf',
    page: 42,
    totalPages: 200,
    lastOpenedAt: Date.now() - 3600e3,
    originalIndex: 0,
    ...overrides
  }
}

const t = (key: string) => key

interface RenderOptions {
  isInvalid?: boolean
  canClear?: boolean
  onRelink?: () => void
}

function renderItem(options: RenderOptions = {}) {
  const { isInvalid = false, canClear = true } = options
  const onResume = vi.fn().mockResolvedValue(undefined)
  const onRelink = vi.fn().mockResolvedValue(true)
  const onRemove = vi.fn()

  const view = render(
    <TooltipProvider>
      <PdfRecentListItem
        item={makeItem()}
        activePdfPath={undefined}
        isInvalid={isInvalid}
        t={t}
        language="en"
        onResume={onResume}
        onRelink={onRelink}
        onRemove={onRemove}
        canClear={canClear}
      />
    </TooltipProvider>
  )

  return { onResume, onRelink, onRemove, view }
}

describe('PdfRecentListItem', () => {
  it('resume button click resumes exactly once and does not trigger the card handler', () => {
    const { onResume } = renderItem()

    fireEvent.click(screen.getByRole('button', { name: 'continue_reading' }))

    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('card body click resumes once', () => {
    const { onResume, view } = renderItem()

    fireEvent.click(screen.getByRole('button', { name: 'continue_reading: Math Book.pdf' }))
    expect(onResume).toHaveBeenCalledTimes(1)

    fireEvent.click(view.container.querySelector('.pdf-recent-item') as HTMLElement)
    expect(onResume).toHaveBeenCalledTimes(2)
  })

  it('relink button click relinks once and never resumes', () => {
    const { onResume, onRelink } = renderItem({ isInvalid: true })

    fireEvent.click(screen.getByRole('button', { name: 'choose_new_location' }))

    expect(onRelink).toHaveBeenCalledTimes(1)
    expect(onResume).not.toHaveBeenCalled()
  })

  it('remove button click removes once and never resumes', () => {
    const { onResume, onRemove } = renderItem()

    fireEvent.click(screen.getByRole('button', { name: 'remove_from_history' }))

    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onResume).not.toHaveBeenCalled()
  })

  it('resume button does not resume on Space keydown and resumes once on click', () => {
    const { onResume } = renderItem()
    const resumeButton = screen.getByRole('button', { name: 'continue_reading' })

    fireEvent.keyDown(resumeButton, { key: ' ' })
    expect(onResume).not.toHaveBeenCalled()

    fireEvent.click(resumeButton)
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('resume button does not remove on Delete keydown', () => {
    const { onRemove } = renderItem()
    const resumeButton = screen.getByRole('button', { name: 'continue_reading' })

    fireEvent.keyDown(resumeButton, { key: 'Delete' })

    expect(onRemove).not.toHaveBeenCalled()
  })

  describe('valid item keyboard behavior', () => {
    it('Enter on the card resumes once', () => {
      const { onResume } = renderItem()
      const card = screen.getByRole('button', { name: 'continue_reading: Math Book.pdf' })

      fireEvent.keyDown(card, { key: 'Enter' })

      expect(onResume).toHaveBeenCalledTimes(1)
    })

    it('Space on the card resumes once', () => {
      const { onResume } = renderItem()
      const card = screen.getByRole('button', { name: 'continue_reading: Math Book.pdf' })

      fireEvent.keyDown(card, { key: ' ' })

      expect(onResume).toHaveBeenCalledTimes(1)
    })

    it('Delete on the card removes once and does not resume', () => {
      const { onResume, onRemove } = renderItem()
      const card = screen.getByRole('button', { name: 'continue_reading: Math Book.pdf' })

      fireEvent.keyDown(card, { key: 'Delete' })

      expect(onRemove).toHaveBeenCalledTimes(1)
      expect(onResume).not.toHaveBeenCalled()
    })
  })

  describe('invalid item interaction', () => {
    it('card is not a button and not keyboard focusable', () => {
      const { view } = renderItem({ isInvalid: true })
      const card = view.container.querySelector('.pdf-recent-item') as HTMLElement

      expect(card.getAttribute('role')).toBeNull()
      expect(card.getAttribute('tabindex')).toBeNull()
    })

    it('clicking the card does not resume', () => {
      const { onResume, view } = renderItem({ isInvalid: true })
      const card = view.container.querySelector('.pdf-recent-item') as HTMLElement

      fireEvent.click(card)

      expect(onResume).not.toHaveBeenCalled()
    })

    it('Enter, Space, and Delete on the card do not resume or remove', () => {
      const { onResume, onRemove, view } = renderItem({ isInvalid: true })
      const card = view.container.querySelector('.pdf-recent-item') as HTMLElement

      fireEvent.keyDown(card, { key: 'Enter' })
      fireEvent.keyDown(card, { key: ' ' })
      fireEvent.keyDown(card, { key: 'Delete' })

      expect(onResume).not.toHaveBeenCalled()
      expect(onRemove).not.toHaveBeenCalled()
    })

    it('relink and remove buttons still work', () => {
      const { onResume, onRelink, onRemove } = renderItem({ isInvalid: true })

      fireEvent.click(screen.getByRole('button', { name: 'choose_new_location' }))
      expect(onRelink).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button', { name: 'remove_from_history' }))
      expect(onRemove).toHaveBeenCalledTimes(1)

      expect(onResume).not.toHaveBeenCalled()
    })
  })
})
