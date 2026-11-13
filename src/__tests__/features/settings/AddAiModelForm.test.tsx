import AddAiModelForm from '@features/settings/ui/models/AddAiModelForm'
import { useHasDirtySettings } from '@features/settings/ui/modal/settingsDirtyGuard'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@platform/electron/api/useSettingsAiApi', () => ({
  useAddCustomAi: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showError: vi.fn() })
}))

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    )
  }
}))

function DirtyProbe() {
  return <span data-testid="dirty">{String(useHasDirtySettings())}</span>
}

function renderForm(showAddForm = true) {
  return render(
    <>
      <AddAiModelForm
        showAddForm={showAddForm}
        setShowAddForm={vi.fn()}
        onSuccess={vi.fn()}
        t={(key: string) => key}
      />
      <DirtyProbe />
    </>
  )
}

describe('AddAiModelForm unsaved state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports dirty as soon as a field has content', () => {
    renderForm()
    expect(screen.getByTestId('dirty')).toHaveTextContent('false')

    const [name] = screen.getAllByRole('textbox')
    fireEvent.change(name!, { target: { value: 'My local model' } })
    expect(screen.getByTestId('dirty')).toHaveTextContent('true')

    // Undoing the edit is not a dirty draft.
    fireEvent.change(name!, { target: { value: '' } })
    expect(screen.getByTestId('dirty')).toHaveTextContent('false')
  })
})
