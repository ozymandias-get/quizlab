import { FloatingDockIcon } from '@app/ui/BottomBar/FloatingDockIcon'
import { TooltipProvider } from '@shared/ui/components/primitives'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

const renderIcon = (ui: ReactElement) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)

describe('FloatingDockIcon', () => {
  it('reports an unpressed toggle instead of dropping aria-pressed', () => {
    renderIcon(
      <FloatingDockIcon title="Swap layout" isActive={false} onClick={vi.fn()}>
        <span />
      </FloatingDockIcon>
    )

    expect(screen.getByRole('button', { name: 'Swap layout' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('reports the pressed state of an active toggle', () => {
    renderIcon(
      <FloatingDockIcon title="Swap layout" isActive onClick={vi.fn()}>
        <span />
      </FloatingDockIcon>
    )

    expect(screen.getByRole('button', { name: 'Swap layout' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('does not give a normal action button toggle semantics', () => {
    renderIcon(
      <FloatingDockIcon title="Settings" onClick={vi.fn()}>
        <span />
      </FloatingDockIcon>
    )

    expect(screen.getByRole('button', { name: 'Settings' })).not.toHaveAttribute('aria-pressed')
  })

  it('activates with Enter and Space but ignores keyboard auto-repeat', () => {
    const onClick = vi.fn()
    renderIcon(
      <FloatingDockIcon title="Picker" onClick={onClick}>
        <span />
      </FloatingDockIcon>
    )
    const button = screen.getByRole('button', { name: 'Picker' })

    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyDown(button, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(button, { key: 'Enter', repeat: true })
    fireEvent.keyDown(button, { key: ' ', repeat: true })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('keeps a disabled action out of the tab order and inert to activation', () => {
    const onClick = vi.fn()
    renderIcon(
      <FloatingDockIcon title="PDF focus" disabled onClick={onClick}>
        <span />
      </FloatingDockIcon>
    )
    const button = screen.getByRole('button', { name: 'PDF focus' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('appends the spoken status without duplicating it', () => {
    const { rerender } = renderIcon(
      <FloatingDockIcon
        title="ChatGPT"
        status="generating"
        statusLabel="Generating"
        onClick={vi.fn()}
      >
        <span />
      </FloatingDockIcon>
    )

    expect(screen.getByRole('button', { name: 'ChatGPT, Generating' })).toBeInTheDocument()

    rerender(
      <TooltipProvider delayDuration={0}>
        <FloatingDockIcon
          title="ChatGPT, Generating"
          status="generating"
          statusLabel="Generating"
          onClick={vi.fn()}
        >
          <span />
        </FloatingDockIcon>
      </TooltipProvider>
    )
    expect(screen.getByRole('button', { name: 'ChatGPT, Generating' })).toBeInTheDocument()
  })
})
