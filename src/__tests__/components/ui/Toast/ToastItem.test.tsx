import ToastItem from '@app/components/Toast/ToastItem'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => {
  const t = (key: string, params?: any) => key + (params ? JSON.stringify(params) : '')
  return {
    useTranslation: () => ({ t, i18n: { language: 'en' } })
  }
})

vi.mock('motion/react', () => ({
  motion: {
    div: ({
      children,
      layout,
      layoutId,
      initial,
      animate,
      exit,
      transition,
      variants,
      whileHover,
      whileTap,
      ...props
    }: any) => (
      <div {...props} data-testid="motion-div">
        {children}
      </div>
    )
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('ToastItem', () => {
  const mockOnRemove = vi.fn()
  const mockToast = {
    id: '123',
    type: 'success' as const,
    title: 'Success Title',
    message: 'Success Message',
    duration: 1000,
    createdAt: Date.now()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mockOnRemove.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const root = () => screen.getAllByTestId('motion-div')[0]

  it('should call onRemove when close button is clicked', () => {
    render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

    const closeButton = screen.getByRole('button')
    fireEvent.click(closeButton)

    expect(mockOnRemove).toHaveBeenCalledWith('123')
  })

  it('reports a dismissal when the close button is clicked', () => {
    const onDismiss = vi.fn()
    render(<ToastItem toast={{ ...mockToast, onDismiss }} onRemove={mockOnRemove} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('reports a dismissal when the action is used, after running it', () => {
    const order: string[] = []
    const onAction = vi.fn(() => order.push('action'))
    const onDismiss = vi.fn(() => order.push('dismiss'))
    render(
      <ToastItem
        toast={{ ...mockToast, actionLabel: 'download', onAction, onDismiss }}
        onRemove={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'download' }))

    expect(order).toEqual(['action', 'dismiss'])
    expect(mockOnRemove).toHaveBeenCalledWith('123')
  })

  it('does not report a dismissal when the timer expires', () => {
    const onDismiss = vi.fn()
    render(<ToastItem toast={{ ...mockToast, onDismiss }} onRemove={mockOnRemove} />)

    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('should call onRemove after duration timeout', () => {
    render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(mockOnRemove).toHaveBeenCalledWith('123')
  })

  it('keeps a toast with duration 0 open until it is dismissed', () => {
    render(<ToastItem toast={{ ...mockToast, duration: 0 }} onRemove={mockOnRemove} />)

    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(mockOnRemove).not.toHaveBeenCalled()
  })

  it('restarts the timer when the same toast receives a new duration', () => {
    const { rerender } = render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

    act(() => {
      vi.advanceTimersByTime(600)
    })

    rerender(<ToastItem toast={{ ...mockToast, duration: 3000 }} onRemove={mockOnRemove} />)

    // The old 1000ms deadline must not fire anymore.
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(mockOnRemove).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2200)
    })
    expect(mockOnRemove).toHaveBeenCalledWith('123')
  })

  it('should pause timer on mouse enter', () => {
    render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

    const container = screen.getAllByTestId('motion-div')[0]

    act(() => {
      vi.advanceTimersByTime(500)
    })

    fireEvent.mouseEnter(container)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(mockOnRemove).not.toHaveBeenCalled()

    fireEvent.mouseLeave(container)

    act(() => {
      vi.advanceTimersByTime(600)
    })

    expect(mockOnRemove).toHaveBeenCalledWith('123')
  })

  it('should pause the timer while keyboard focus is inside the toast', () => {
    render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

    const closeButton = screen.getByRole('button')

    act(() => {
      vi.advanceTimersByTime(400)
    })

    act(() => {
      closeButton.focus()
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockOnRemove).not.toHaveBeenCalled()

    act(() => {
      closeButton.blur()
    })

    act(() => {
      vi.advanceTimersByTime(700)
    })

    expect(mockOnRemove).toHaveBeenCalledWith('123')
  })

  describe('background cards', () => {
    it('leaves the tab order and the accessibility tree while behind the front card', () => {
      render(<ToastItem toast={mockToast} onRemove={mockOnRemove} paused />)

      expect(root()).toHaveAttribute('inert')
      expect(root()).toHaveAttribute('aria-hidden', 'true')
    })

    it('stays usable when focus is already inside the demoted card', () => {
      const { rerender } = render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)
      const closeButton = screen.getByRole('button')

      act(() => {
        closeButton.focus()
      })

      // A new toast arrives and pushes this one to the back. Focus must not be
      // dropped to <body> by making the focused subtree inert.
      rerender(<ToastItem toast={mockToast} onRemove={mockOnRemove} paused />)

      expect(root()).not.toHaveAttribute('inert')
      expect(root()).not.toHaveAttribute('aria-hidden')

      act(() => {
        closeButton.blur()
      })

      expect(root()).toHaveAttribute('inert')
      expect(root()).toHaveAttribute('aria-hidden', 'true')
    })

    it('does not re-enable pointer events on its own root', () => {
      render(<ToastItem toast={mockToast} onRemove={mockOnRemove} paused />)

      expect(root()).not.toHaveClass('pointer-events-auto')
    })

    it('resumes a demoted card with the time it had left', () => {
      const { rerender } = render(
        <ToastItem toast={{ ...mockToast, duration: 5000 }} onRemove={mockOnRemove} />
      )

      act(() => {
        vi.advanceTimersByTime(3000)
      })
      rerender(
        <ToastItem toast={{ ...mockToast, duration: 5000 }} onRemove={mockOnRemove} paused />
      )

      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(mockOnRemove).not.toHaveBeenCalled()

      rerender(<ToastItem toast={{ ...mockToast, duration: 5000 }} onRemove={mockOnRemove} />)

      act(() => {
        vi.advanceTimersByTime(1900)
      })
      expect(mockOnRemove).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(mockOnRemove).toHaveBeenCalledWith('123')
    })
  })

  describe('progress bar', () => {
    const progressBar = () => screen.getByTestId('toast-progress')

    it('keeps the bar at its frozen offset when a paused toast resumes', () => {
      render(<ToastItem toast={{ ...mockToast, duration: 5000 }} onRemove={mockOnRemove} />)

      const initialBar = progressBar()
      expect(initialBar.style.animation).toContain('5000ms')
      expect(initialBar.style.animationPlayState).toBe('running')

      act(() => {
        vi.advanceTimersByTime(3000)
      })
      fireEvent.mouseEnter(root())

      expect(progressBar()).toBe(initialBar)
      expect(progressBar().style.animationPlayState).toBe('paused')

      // Hovering longer than the original lifetime must not dismiss or restart.
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(mockOnRemove).not.toHaveBeenCalled()

      fireEvent.mouseLeave(root())

      // Same element: only the play state changed, so the bar cannot jump back
      // to 100% while the timeout has only 2s left.
      expect(progressBar()).toBe(initialBar)
      expect(progressBar().style.animationPlayState).toBe('running')
      expect(progressBar().style.animation).toContain('5000ms')

      act(() => {
        vi.advanceTimersByTime(1900)
      })
      expect(mockOnRemove).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(mockOnRemove).toHaveBeenCalledWith('123')
    })

    it('renders no progress bar for a persistent toast', () => {
      render(<ToastItem toast={{ ...mockToast, duration: 0 }} onRemove={mockOnRemove} />)

      expect(screen.queryByTestId('toast-progress')).not.toBeInTheDocument()
    })

    it('restarts the bar and the timeout together on a duration update', () => {
      const { rerender } = render(
        <ToastItem toast={{ ...mockToast, duration: 5000 }} onRemove={mockOnRemove} />
      )

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      fireEvent.mouseEnter(root())

      // Apply the new duration while paused: the bar is rebuilt for the new
      // total, but the timeout stays stopped.
      rerender(<ToastItem toast={{ ...mockToast, duration: 3000 }} onRemove={mockOnRemove} />)

      expect(progressBar().style.animation).toContain('3000ms')
      expect(progressBar().style.animationPlayState).toBe('paused')

      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(mockOnRemove).not.toHaveBeenCalled()

      fireEvent.mouseLeave(root())

      act(() => {
        vi.advanceTimersByTime(2900)
      })
      expect(mockOnRemove).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(mockOnRemove).toHaveBeenCalledWith('123')
    })
  })

  describe('message rendering', () => {
    const messageOf = () => screen.getAllByTestId('motion-div')[0].querySelector('p')!

    it('keeps the sentence punctuation that follows a URL', () => {
      render(
        <ToastItem
          toast={{ ...mockToast, message: 'Open https://example.com/a. Then retry.' }}
          onRemove={mockOnRemove}
        />
      )

      expect(screen.getByRole('link')).toHaveTextContent('https://example.com/a')
      expect(messageOf().textContent).toBe('Open https://example.com/a. Then retry.')
    })

    it('keeps a closing bracket that belongs to the URL', () => {
      render(
        <ToastItem
          toast={{ ...mockToast, message: 'See https://en.wikipedia.org/wiki/Foo_(bar).' }}
          onRemove={mockOnRemove}
        />
      )

      expect(screen.getByRole('link')).toHaveTextContent('https://en.wikipedia.org/wiki/Foo_(bar)')
      expect(messageOf().textContent).toBe('See https://en.wikipedia.org/wiki/Foo_(bar).')
    })

    it('keeps file-path punctuation outside the selectable path', () => {
      render(
        <ToastItem
          toast={{ ...mockToast, message: String.raw`Failed at C:\Users\me\notes.txt.` }}
          onRemove={mockOnRemove}
        />
      )

      expect(screen.getByText(String.raw`C:\Users\me\notes.txt`)).toBeInTheDocument()
      expect(messageOf().textContent).toBe(String.raw`Failed at C:\Users\me\notes.txt.`)
    })
  })
})
