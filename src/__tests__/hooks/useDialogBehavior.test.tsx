import { useIsAnyDialogOpen } from '@shared/hooks'
import { useDialogBehavior } from '@shared/hooks/useDialogBehavior'

import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
