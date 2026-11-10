import type { Tab } from '@app/providers/ai-context'
import AiVisibleTabButton from '@features/ai/ui/aiTabStrip/AiVisibleTabButton'

import { fireEvent, render, screen } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ui/components/Icons', () => ({
  getAiIcon: () => null
}))

vi.mock('@shared/ui/components/primitives', async () => {
  const ReactModule = await import('react')
  const PassThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>

  const TabPillContainer = ({
    isActive: _isActive,
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { isActive?: boolean }) => (
    <div {...props}>{children}</div>
  )

  const TabPillLabel = ReactModule.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & { isActive?: boolean }
  >(({ isActive: _isActive, ...props }, ref) => <span ref={ref} {...props} />)

  const IconButton = ReactModule.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, ...props }, ref) => (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  ))

  return {
    IconButton,
    TabPillContainer,
    TabPillIcon: PassThrough,
    TabPillLabel,
    Tooltip: PassThrough,
    TooltipContent: PassThrough,
    TooltipTrigger: PassThrough
  }
})

const TAB = { id: 'tab-1', modelId: 'chatgpt', title: 'Original', isPinned: false } as Tab

function renderEditing(overrides: Partial<React.ComponentProps<typeof AiVisibleTabButton>> = {}) {
  const onCommitRename = vi.fn()
  const onCancelRename = vi.fn()
  const onSelect = vi.fn()
  const onBeginRename = vi.fn()

  render(
    <AiVisibleTabButton
      tab={TAB}
      label="Original"
      tabColor="#fff"
      isActive
      isEditing
      editingValue="Renamed"
      renameInputRef={React.createRef<HTMLInputElement>()}
      skipBlurSaveRef={{ current: false }}
      tr={(key, fallback) => fallback ?? key}
      onSelect={onSelect}
      onBeginRename={onBeginRename}
      onContextMenu={vi.fn()}
      onEditingValueChange={vi.fn()}
      onCommitRename={onCommitRename}
      onCancelRename={onCancelRename}
      onTogglePin={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  )

  return { onCommitRename, onCancelRename, onSelect, onBeginRename }
}

describe('AiVisibleTabButton rename keyboard handling', () => {
  it('commits on Enter without bubbling into tab selection', () => {
    const { onCommitRename, onSelect } = renderEditing()
    const input = screen.getByRole('textbox')

    const notCancelled = fireEvent.keyDown(input, { key: 'Enter' })

    // fireEvent returns false when preventDefault was called.
    expect(notCancelled).toBe(false)
    expect(onCommitRename).toHaveBeenCalledWith('tab-1', 'Renamed')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('cancels on Escape without selecting the tab', () => {
    const { onCancelRename, onSelect } = renderEditing()
    const input = screen.getByRole('textbox')

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onCancelRename).toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('AiVisibleTabButton double-click rename', () => {
  it('does not rename when a rapid double-click only activates an inactive tab', () => {
    const onBeginRename = vi.fn()

    function Harness() {
      const [isActive, setIsActive] = React.useState(false)
      return (
        <AiVisibleTabButton
          tab={TAB}
          label="Original"
          tabColor="#fff"
          isActive={isActive}
          isEditing={false}
          editingValue=""
          renameInputRef={React.createRef<HTMLInputElement>()}
          skipBlurSaveRef={{ current: false }}
          tr={(key, fallback) => fallback ?? key}
          onSelect={() => setIsActive(true)}
          onBeginRename={onBeginRename}
          onContextMenu={vi.fn()}
          onEditingValueChange={vi.fn()}
          onCommitRename={vi.fn()}
          onCancelRename={vi.fn()}
          onTogglePin={vi.fn()}
          onClose={vi.fn()}
        />
      )
    }

    render(<Harness />)
    const surface = screen.getByLabelText('Original')

    fireEvent.click(surface)
    // The click re-rendered the tab as active. The second click of the same
    // gesture must still select, not open the rename input.
    fireEvent.doubleClick(surface)

    expect(onBeginRename).not.toHaveBeenCalled()
  })

  it('renames when the tab was already active', () => {
    const { onBeginRename } = renderEditing({ isActive: true, isEditing: false })
    const surface = screen.getByLabelText('Original')

    fireEvent.doubleClick(surface)

    expect(onBeginRename).toHaveBeenCalledWith('tab-1')
  })
})
