import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GeminiWebLoginOverlay, {
  type GeminiWebLoginOverlayMode
} from '@app/ui/GeminiWebLoginOverlay'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        gws_toolbar_title: 'Google Session',
        gws_overlay_login_title: 'Verifying Google session',
        gws_overlay_login_description:
          'Complete sign-in or any required Google verification in the browser.',
        gws_overlay_refresh_title: 'Session refreshing in background',
        gws_overlay_refresh_description: 'Refreshing silently in the background.',
        gws_overlay_badge: 'Please wait',
        gws_overlay_dismiss_btn: 'Hide this prompt',
        gws_overlay_dismiss_hint: 'Sign-in continues in the background (press ESC to hide)'
      }
      return translations[key] ?? key
    },
    i18n: { language: 'en' }
  })
}))

vi.mock('motion/react', () => {
  const createMockMotion = (tag: 'div') => {
    return forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => createElement(tag, { ...props, ref }, children)
    )
  }
  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
      div: createMockMotion('div')
    }
  }
})

interface RenderOpts {
  mode: GeminiWebLoginOverlayMode
  onDismiss?: () => void
}

const renderOverlay = ({ mode, onDismiss }: RenderOpts) =>
  render(<GeminiWebLoginOverlay mode={mode} {...(onDismiss ? { onDismiss } : {})} />)

/**
 * Flushes any pending microtasks + animation frames. The overlay's autofocus
 * runs inside a `requestAnimationFrame` callback so we need to wait at least
 * one frame for it to settle before asserting on `document.activeElement`.
 */
async function flushAnimationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('GeminiWebLoginOverlay', () => {
  let originalOverflow: string
  let originalOffsetWidth: PropertyDescriptor | undefined
  let originalOffsetHeight: PropertyDescriptor | undefined

  beforeEach(() => {
    originalOverflow = document.body.style.overflow
    // jsdom doesn't support offsetWidth/offsetHeight, so mock it for focusable elements
    originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 100 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 100 })
  })
  afterEach(() => {
    act(() => {
      document.body.style.overflow = originalOverflow
    })
    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
    } else {
      delete (HTMLElement.prototype as any).offsetWidth
    }
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
    } else {
      delete (HTMLElement.prototype as any).offsetHeight
    }
  })

  it('does not render anything when mode is "hidden"', () => {
    renderOverlay({ mode: 'hidden' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the login mode with login-specific copy and a dismiss button', () => {
    renderOverlay({ mode: 'login' })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-busy', 'true')
    expect(dialog.querySelector('h2')).toHaveTextContent('Verifying Google session')
    expect(
      screen.getByText('Complete sign-in or any required Google verification in the browser.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide this prompt' })).toBeInTheDocument()
    expect(
      screen.getByText('Sign-in continues in the background (press ESC to hide)')
    ).toBeInTheDocument()
  })

  it('renders the refresh mode with refresh-specific copy and no dismiss button', () => {
    renderOverlay({ mode: 'refreshing' })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.querySelector('h2')).toHaveTextContent('Session refreshing in background')
    expect(screen.getByText('Refreshing silently in the background.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hide this prompt' })).not.toBeInTheDocument()
    expect(
      screen.queryByText('Sign-in continues in the background (press ESC to hide)')
    ).not.toBeInTheDocument()
  })

  it('wires aria-labelledby and aria-describedby to the title and description', () => {
    renderOverlay({ mode: 'login' })
    const dialog = screen.getByRole('dialog')
    const titleId = dialog.getAttribute('aria-labelledby')
    const descriptionId = dialog.getAttribute('aria-describedby')
    expect(titleId).toBeTruthy()
    expect(descriptionId).toBeTruthy()
    if (titleId) {
      expect(document.getElementById(titleId)).toHaveTextContent('Verifying Google session')
    }
    if (descriptionId) {
      expect(document.getElementById(descriptionId)).toHaveTextContent(
        'Complete sign-in or any required Google verification in the browser.'
      )
    }
  })

  it('hides decorative icons from assistive tech via aria-hidden', () => {
    const { container } = renderOverlay({ mode: 'login' })
    const ariaHidden = container.querySelectorAll('[aria-hidden="true"]')
    expect(ariaHidden.length).toBeGreaterThan(0)
  })

  it('calls onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    renderOverlay({ mode: 'login', onDismiss })
    fireEvent.click(screen.getByRole('button', { name: 'Hide this prompt' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when Escape is pressed in login mode', () => {
    const onDismiss = vi.fn()
    renderOverlay({ mode: 'login', onDismiss })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not call onDismiss when Escape is pressed in refreshing mode', () => {
    const onDismiss = vi.fn()
    renderOverlay({ mode: 'refreshing', onDismiss })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('locks body scroll while the dialog is visible and restores it on close', () => {
    const { rerender } = renderOverlay({ mode: 'login' })
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<GeminiWebLoginOverlay mode="hidden" />)
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('restores body overflow to its original value (not to "hidden")', () => {
    // Simulate a previous overlay (e.g., screenshot tool) having already
    // set the overflow to 'hidden'. Our overlay should not clobber it on
    // close.
    document.body.style.overflow = 'scroll'
    const { rerender } = renderOverlay({ mode: 'login' })
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<GeminiWebLoginOverlay mode="hidden" />)
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('does not trap Tab focus to nothing when the dialog has no focusable controls (refresh mode)', () => {
    renderOverlay({ mode: 'refreshing' })
    // No buttons exist in refresh mode; pressing Tab must not crash or
    // throw, and should keep focus on the dialog container itself.
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cycles focus between the dialog and the dismiss button when tabbing', async () => {
    renderOverlay({ mode: 'login' })

    // Wait for the autofocus (inside requestAnimationFrame) to settle.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hide this prompt' }))
    })

    // Tab from the last focusable element should wrap back to the first one.
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hide this prompt' }))

    // Shift+Tab from the first focusable element should wrap to the last one.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hide this prompt' }))
  })

  it('restores focus to a previously-focused external element after the dialog unmounts', async () => {
    const externalButton = document.createElement('button')
    externalButton.textContent = 'external'
    document.body.appendChild(externalButton)
    externalButton.focus()
    expect(document.activeElement).toBe(externalButton)

    const { rerender } = renderOverlay({ mode: 'login' })
    await flushAnimationFrame()

    rerender(<GeminiWebLoginOverlay mode="hidden" />)

    // The focus restoration runs on a 250ms timeout to wait for the
    // AnimatePresence exit animation to complete. Wait it out, then assert.
    await waitFor(
      () => {
        expect(document.activeElement).toBe(externalButton)
      },
      { timeout: 1000 }
    )

    externalButton.remove()
  })
})
