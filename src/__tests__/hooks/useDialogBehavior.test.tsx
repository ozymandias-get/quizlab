import { useIsAnyDialogOpen } from '@shared/hooks'
import { useDialogBehavior } from '@shared/hooks/useDialogBehavior'

import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Listeners registered straight on `document` / `window` outlive RTL's cleanup,
 * which only unmounts React trees. `useDialogBehavior` now handles Escape at
 * `window` capture and bails on `defaultPrevented`, so one leaked `preventDefault`
 * listener would silently disable Escape for every later test in this file and
 * report as a failure somewhere unrelated. Reset both by hand.
 */
const leakedListeners: Array<[string, EventListener]> = []

function trackListener(target: EventTarget, type: string, listener: EventListener): void {
  leakedListeners.push([type, listener])
  target.addEventListener(type, listener)
}

beforeEach(() => {
  document.body.style.overflow = ''
})

afterEach(() => {
  for (const [type, listener] of leakedListeners.splice(0)) {
    document.removeEventListener(type, listener)
  }
  document.body.style.overflow = ''
})

/** Minimal dialog that follows the shared standard. */
function Dialog({
  isOpen,
  onClose,
  label
}: {
  isOpen: boolean
  onClose: () => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogBehavior({ isOpen, onClose, dialogRef: ref })
  if (!isOpen) return null
  return (
    <div ref={ref} role="dialog" aria-label={label}>
      <button onClick={onClose}>{`close-${label}`}</button>
    </div>
  )
}

/** Drives the registry from the outside so tests can flip it. */
let externalOpen = false
function RegistryProbe() {
  return <span data-testid="probe">{String(useIsAnyDialogOpen())}</span>
}

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <Dialog isOpen={open || externalOpen} onClose={() => setOpen(false)} label="test" />
      <RegistryProbe />
    </>
  )
}

describe('useIsAnyDialogOpen', () => {
  it('keeps the inner dialog active when an outer callback changes', () => {
    const innerClose = vi.fn()
    const firstOuterClose = vi.fn()
    const nextOuterClose = vi.fn()
    const { rerender } = render(
      <>
        <Dialog isOpen onClose={firstOuterClose} label="outer" />
        <Dialog isOpen onClose={innerClose} label="inner" />
      </>
    )
    rerender(
      <>
        <Dialog isOpen onClose={nextOuterClose} label="outer" />
        <Dialog isOpen onClose={innerClose} label="inner" />
      </>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(innerClose).toHaveBeenCalledTimes(1)
    expect(firstOuterClose).not.toHaveBeenCalled()
    expect(nextOuterClose).not.toHaveBeenCalled()
  })
  it('handles Escape before workspace document listeners', () => {
    const workspace = vi.fn((event: KeyboardEvent) => event.preventDefault())
    // Tracked so `afterEach` removes it even if an assertion below throws: the
    // hook bails on `defaultPrevented`, so a leaked listener here would make
    // every later Escape test in this file pass for the wrong reason.
    trackListener(document, 'keydown', workspace as unknown as EventListener)
    const close = vi.fn()
    render(<Dialog isOpen onClose={close} label="confirmation" />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'close-confirmation' }), { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(workspace).not.toHaveBeenCalled()
  })
  it('closes only the top dialog on Escape', () => {
    const outerClose = vi.fn()
    const innerClose = vi.fn()
    render(
      <>
        <Dialog isOpen onClose={outerClose} label="outer" />
        <Dialog isOpen onClose={innerClose} label="inner" />
      </>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(innerClose).toHaveBeenCalledTimes(1)
    expect(outerClose).not.toHaveBeenCalled()
  })

  it('keeps scrolling locked when a lower dialog closes first', () => {
    document.body.style.overflow = 'auto'
    const close = vi.fn()
    const { rerender, unmount } = render(
      <>
        <Dialog isOpen onClose={close} label="outer" />
        <Dialog isOpen onClose={close} label="inner" />
      </>
    )
    rerender(
      <>
        <Dialog isOpen={false} onClose={close} label="outer" />
        <Dialog isOpen onClose={close} label="inner" />
      </>
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  beforeEach(() => {
    externalOpen = false
  })

  it('is false while no dialog is open', () => {
    render(<RegistryProbe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
  })

  it('flips true while a standard dialog is open and back on close', () => {
    render(<Harness />)

    expect(screen.getByTestId('probe')).toHaveTextContent('false')

    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByTestId('probe')).toHaveTextContent('true')

    fireEvent.click(screen.getByRole('button', { name: 'close-test' }))
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
  })

  it('stays true while a second dialog is still open', () => {
    // The count, not a boolean, is what keeps this correct: closing one dialog
    // must not unblock the views while another is still up.
    function TwoDialogs() {
      const [first, setFirst] = useState(true)
      const [second, setSecond] = useState(true)
      return (
        <>
          <Dialog isOpen={first} onClose={() => setFirst(false)} label="first" />
          <Dialog isOpen={second} onClose={() => setSecond(false)} label="second" />
          <RegistryProbe />
        </>
      )
    }

    render(<TwoDialogs />)
    expect(screen.getByTestId('probe')).toHaveTextContent('true')

    fireEvent.click(screen.getByRole('button', { name: 'close-first' }))
    expect(screen.getByTestId('probe')).toHaveTextContent('true')
  })

  it('releases the registry when the dialog unmounts while open', () => {
    const { rerender } = render(
      <>
        <Dialog isOpen onClose={vi.fn()} label="test" />
        <RegistryProbe />
      </>
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('true')

    rerender(<RegistryProbe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
  })

  it('does not count a closed dialog', () => {
    render(
      <>
        <Dialog isOpen={false} onClose={vi.fn()} label="test" />
        <RegistryProbe />
      </>
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
  })

  // One dialog open must be visible to every subscriber, not just the one that
  // happened to mount last: two panels on opposite sides of the workspace each
  // close themselves when any dialog is open.
  it('skips hidden and inert controls when trapping Tab', () => {
    function HiddenControlsDialog() {
      const ref = useRef<HTMLDivElement>(null)
      useDialogBehavior({ isOpen: true, onClose: vi.fn(), dialogRef: ref })
      return (
        <div ref={ref} role="dialog" aria-label="hidden-controls">
          <button hidden>hidden-first</button>
          <button>visible-first</button>
          <button style={{ display: 'none' }}>hidden-middle</button>
          <div inert>
            <button>inert-button</button>
          </div>
          <button>visible-last</button>
        </div>
      )
    }

    render(<HiddenControlsDialog />)
    const first = screen.getByRole('button', { name: 'visible-first' })
    const last = screen.getByRole('button', { name: 'visible-last' })
    first.focus()

    // Shift+Tab at the first *visible* control wraps to the last visible one;
    // hidden/inert controls never become the wrap target.
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Tab' })
    expect(first).toHaveFocus()

    const hiddenFirst = document.querySelector<HTMLButtonElement>('button[hidden]')
    const hiddenMiddle = document.querySelector<HTMLButtonElement>('button[style]')
    expect(hiddenFirst).not.toHaveFocus()
    expect(hiddenMiddle).not.toHaveFocus()
    expect(screen.getByRole('button', { name: 'inert-button' })).not.toHaveFocus()
  })

  it('skips negative tabindex controls when trapping Tab', () => {
    function RovingDialog() {
      const ref = useRef<HTMLDivElement>(null)
      useDialogBehavior({ isOpen: true, onClose: vi.fn(), dialogRef: ref })
      return (
        <div ref={ref} role="dialog" aria-label="roving">
          <button tabIndex={-1}>negative-first</button>
          <button>visible-first</button>
          <button tabIndex={-1}>negative-last</button>
          <button>visible-last</button>
        </div>
      )
    }

    render(<RovingDialog />)
    const first = screen.getByRole('button', { name: 'visible-first' })
    const last = screen.getByRole('button', { name: 'visible-last' })
    first.focus()

    // The negative-tabindex buttons are programmatically focusable but are not
    // part of the document tab order, so they must not become the wrap target.
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(first).toHaveFocus()
  })

  it('lets a focused Escape-owning popup dismiss itself before closing the dialog', () => {
    const close = vi.fn()
    function DialogWithPopup() {
      const ref = useRef<HTMLDivElement>(null)
      useDialogBehavior({ isOpen: true, onClose: close, dialogRef: ref })
      return (
        <div ref={ref} role="dialog" aria-label="with-popup">
          <div role="listbox" aria-label="options" data-escape-owned="">
            <button role="option" aria-selected={false}>
              option
            </button>
          </div>
          <button type="button">dialog-action</button>
        </div>
      )
    }

    render(<DialogWithPopup />)

    const option = screen.getByRole('option', { name: 'option' })
    option.focus()
    fireEvent.keyDown(option, { key: 'Escape' })
    expect(close).not.toHaveBeenCalled()

    // The popup has handled (and closed) itself; focus is back in the dialog.
    screen.getByRole('button', { name: 'dialog-action' }).focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not let a plain listbox without Escape ownership hold the dialog', () => {
    const close = vi.fn()
    function DialogWithStaticList() {
      const ref = useRef<HTMLDivElement>(null)
      useDialogBehavior({ isOpen: true, onClose: close, dialogRef: ref })
      return (
        <div ref={ref} role="dialog" aria-label="with-static-list">
          <div role="listbox" aria-label="static options">
            <button role="option" aria-selected={false}>
              static-option
            </button>
          </div>
        </div>
      )
    }

    render(<DialogWithStaticList />)
    screen.getByRole('option', { name: 'static-option' }).focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not let a hidden owned popup hold the dialog', () => {
    const close = vi.fn()
    function DialogWithHiddenPopup() {
      const ref = useRef<HTMLDivElement>(null)
      useDialogBehavior({ isOpen: true, onClose: close, dialogRef: ref })
      return (
        <div ref={ref} role="dialog" aria-label="with-hidden-popup">
          <div role="listbox" aria-label="hidden options" data-escape-owned="" hidden>
            <button role="option" aria-selected={false}>
              hidden-option
            </button>
          </div>
        </div>
      )
    }

    render(<DialogWithHiddenPopup />)
    const hiddenOption = screen.getByRole('option', { name: 'hidden-option', hidden: true })
    hiddenOption.focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not let a closed-state owned popup hold the dialog', () => {
    const close = vi.fn()
    function DialogWithClosedPopup() {
      const ref = useRef<HTMLDivElement>(null)
      useDialogBehavior({ isOpen: true, onClose: close, dialogRef: ref })
      return (
        <div ref={ref} role="dialog" aria-label="with-closed-popup">
          <div role="listbox" aria-label="closed options" data-escape-owned="" data-state="closed">
            <button role="option" aria-selected={false}>
              closed-option
            </button>
          </div>
        </div>
      )
    }

    render(<DialogWithClosedPopup />)
    screen.getByRole('option', { name: 'closed-option' }).focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not let an owned popup outside the focus ring hold the dialog', () => {
    const close = vi.fn()
    function DialogWithIdlePopup() {
      const ref = useRef<HTMLDivElement>(null)
      useDialogBehavior({ isOpen: true, onClose: close, dialogRef: ref })
      return (
        <div ref={ref} role="dialog" aria-label="with-idle-popup">
          <div role="listbox" aria-label="idle options" data-escape-owned="">
            <button role="option" aria-selected={false}>
              idle-option
            </button>
          </div>
          <button type="button">dialog-action</button>
        </div>
      )
    }

    render(<DialogWithIdlePopup />)
    screen.getByRole('button', { name: 'dialog-action' }).focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('reports the same value to every subscriber', () => {
    render(
      <>
        <Dialog isOpen onClose={vi.fn()} label="test" />
        <RegistryProbe />
        <RegistryProbe />
      </>
    )

    expect(screen.getAllByTestId('probe').map((node) => node.textContent)).toEqual(['true', 'true'])
  })
})
