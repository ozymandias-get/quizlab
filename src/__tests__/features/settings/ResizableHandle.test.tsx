import ResizableHandle from '@features/settings/ui/modal/ResizableHandle'

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  vi.restoreAllMocks()
})

describe('ResizableHandle drag lifecycle', () => {
  it('ends the drag when the window loses focus mid-drag', () => {
    const onResize = vi.fn()
    render(<ResizableHandle onResize={onResize} />)
    const handle = screen.getByRole('separator')

    fireEvent.mouseDown(handle, { button: 0, clientX: 100 })
    expect(document.body.style.cursor).toBe('col-resize')

    fireEvent.mouseMove(window, { buttons: 1, clientX: 130 })
    expect(onResize).toHaveBeenLastCalledWith(30)

    fireEvent.blur(window)
    expect(document.body.style.cursor).toBe('')

    // A move after the gesture ended must not keep resizing.
    fireEvent.mouseMove(window, { buttons: 0, clientX: 200 })
    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('stops when the button was released outside the window', () => {
    const onResize = vi.fn()
    render(<ResizableHandle onResize={onResize} />)
    const handle = screen.getByRole('separator')

    fireEvent.mouseDown(handle, { button: 0, clientX: 100 })
    // No mouseup reached the window; the next move reports no buttons.
    fireEvent.mouseMove(window, { buttons: 0, clientX: 220 })

    expect(onResize).not.toHaveBeenCalled()
    expect(document.body.style.cursor).toBe('')
  })

  it('does not clear body styles it never set', () => {
    document.body.style.cursor = 'wait'
    document.body.style.userSelect = 'text'

    const { unmount } = render(<ResizableHandle onResize={vi.fn()} />)
    unmount()

    expect(document.body.style.cursor).toBe('wait')
    expect(document.body.style.userSelect).toBe('text')
  })

  it('restores the pre-drag body styles when unmounted mid-drag', () => {
    document.body.style.cursor = 'wait'

    const { unmount } = render(<ResizableHandle onResize={vi.fn()} />)
    const handle = screen.getByRole('separator')
    fireEvent.mouseDown(handle, { button: 0, clientX: 100 })
    expect(document.body.style.cursor).toBe('col-resize')

    unmount()

    expect(document.body.style.cursor).toBe('wait')
    expect(document.body.style.userSelect).toBe('')
  })

  it('still resizes from the keyboard', () => {
    const onResize = vi.fn()
    render(<ResizableHandle onResize={onResize} />)

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' })
    expect(onResize).toHaveBeenLastCalledWith(10)
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' })
    expect(onResize).toHaveBeenLastCalledWith(-10)
  })
})
