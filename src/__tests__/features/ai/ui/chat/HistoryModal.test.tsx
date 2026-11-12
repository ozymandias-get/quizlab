import HistoryModal from '@features/ai/ui/chat/HistoryModal'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockClearAll = vi.fn()
const mockConfirm = vi.fn()
const mockDelete = vi.fn()
const mockRename = vi.fn()
const mockShowError = vi.fn()

const SESSIONS = [
  {
    id: 's1',
    title: 'Cardiology notes',
    messages: [{ id: 'm1', content: 'lupus nephritis' }],
    createdAt: 1
  },
  {
    id: 's2',
    title: 'Pharmacology',
    messages: [{ id: 'm2', content: 'beta blockers' }],
    createdAt: 2
  }
]

let mockSessions = SESSIONS

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@shared/hooks', () => ({
  useConfirmDialog: () => ({
    confirm: mockConfirm,
    props: { isOpen: false, onConfirm: vi.fn(), onCancel: vi.fn(), title: '' }
  }),
  useDebouncedValue: (value: string) => value,
  useDialogBehavior: () => undefined
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({ showError: mockShowError })
}))

vi.mock('@features/ai/queries/useSessionsQuery', () => ({
  useSessionsQuery: () => ({ data: mockSessions }),
  useDeleteSessionMutation: () => ({ mutateAsync: mockDelete }),
  useRenameSessionMutation: () => ({ mutateAsync: mockRename }),
  useClearAllSessionsMutation: () => ({ mutateAsync: mockClearAll, isPending: false })
}))

vi.mock('@features/ai/store/chatUiStore', () => ({
  useChatUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ activeSessionIdByTab: {}, setActiveSessionId: vi.fn() })
}))

vi.mock('@app/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null
}))

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => {
      void initial
      void animate
      void exit
      void transition
      return <div {...props}>{children}</div>
    }
  }
}))

vi.mock('@features/ai/ui/chat/HistorySessionItem', () => ({
  default: ({
    session,
    editingId,
    editTitle,
    isSavingEdit,
    isDeleting,
    onStartEdit,
    onEditTitleChange,
    onConfirmEdit,
    onDelete
  }: {
    session: { id: string; title: string }
    editingId: string | null
    editTitle: string
    isSavingEdit: boolean
    isDeleting: boolean
    onStartEdit: (sessionId: string, title: string) => void
    onEditTitleChange: (title: string) => void
    onConfirmEdit: (sessionId: string) => Promise<boolean>
    onDelete: (sessionId: string) => void
  }) => (
    <div>
      <span>{session.title}</span>
      <button type="button" onClick={() => onStartEdit(session.id, session.title)}>
        rename-{session.id}
      </button>
      <button type="button" onClick={() => onDelete(session.id)} disabled={isDeleting}>
        delete-{session.id}
      </button>
      {editingId === session.id && (
        <>
          <input
            aria-label={`edit-${session.id}`}
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void onConfirmEdit(session.id)}
            disabled={isSavingEdit || editTitle.trim().length === 0}
          >
            save-{session.id}
          </button>
        </>
      )}
    </div>
  )
}))

describe('HistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessions = SESSIONS
  })

  it('starts with an empty search every time it is reopened', () => {
    const { rerender } = render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    fireEvent.change(screen.getByPlaceholderText('api_chat_modal_search_placeholder'), {
      target: { value: 'cardio' }
    })
    expect(screen.getByDisplayValue('cardio')).toBeInTheDocument()

    rerender(<HistoryModal isOpen={false} onClose={vi.fn()} tabId="tab-1" />)
    rerender(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    expect(screen.getByPlaceholderText('api_chat_modal_search_placeholder')).toHaveValue('')
    expect(screen.getByText('Pharmacology')).toBeInTheDocument()
  })

  it('searches titles and message contents without mutating the session list', () => {
    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)
    const search = screen.getByPlaceholderText('api_chat_modal_search_placeholder')

    fireEvent.change(search, { target: { value: 'lupus' } })
    expect(screen.getByText('Cardiology notes')).toBeInTheDocument()
    expect(screen.queryByText('Pharmacology')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'Pharmacology' } })
    expect(screen.getByText('Pharmacology')).toBeInTheDocument()
    expect(screen.queryByText('Cardiology notes')).not.toBeInTheDocument()
  })

  it('builds a large search index in slices instead of freezing the first search', async () => {
    mockSessions = [
      {
        id: 'big',
        title: 'Big session',
        messages: Array.from({ length: 700 }, (_, index) => ({
          id: `m${index}`,
          content: `old message ${index}`
        })),
        createdAt: 1
      },
      SESSIONS[1]
    ]

    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)
    fireEvent.change(screen.getByPlaceholderText('api_chat_modal_search_placeholder'), {
      target: { value: 'beta blockers' }
    })

    // The first slice exceeded the per-task budget and yielded: the modal shows
    // its pending state rather than a truncated result set.
    expect(screen.getByText('api_chat_searching')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Pharmacology')).toBeInTheDocument())
    expect(screen.queryByText('Big session')).not.toBeInTheDocument()
  })

  it('clears the filter with one click and keeps focus in the search field', () => {
    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    const input = screen.getByPlaceholderText('api_chat_modal_search_placeholder')
    fireEvent.change(input, { target: { value: 'lupus' } })

    fireEvent.click(screen.getByTestId('history-search-clear'))

    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(screen.getByText('Cardiology notes')).toBeInTheDocument()
    expect(screen.getByText('Pharmacology')).toBeInTheDocument()
    expect(screen.queryByTestId('history-search-clear')).not.toBeInTheDocument()
  })

  it('keeps the modal open and reports an error when clearing history fails', async () => {
    mockConfirm.mockResolvedValue(true)
    mockClearAll.mockRejectedValue(new Error('disk full'))
    const onClose = vi.fn()

    render(<HistoryModal isOpen onClose={onClose} tabId="tab-1" />)

    fireEvent.click(screen.getByRole('button', { name: /api_chat_clear_all/ }))

    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('api_chat_clear_all_failed'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('waits for the wipe before closing the modal', async () => {
    mockConfirm.mockResolvedValue(true)
    let resolveClear: (value: unknown) => void = () => undefined
    mockClearAll.mockReturnValue(
      new Promise((resolve) => {
        resolveClear = resolve
      })
    )
    const onClose = vi.fn()

    render(<HistoryModal isOpen onClose={onClose} tabId="tab-1" />)

    fireEvent.click(screen.getByRole('button', { name: /api_chat_clear_all/ }))

    await waitFor(() => expect(mockClearAll).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()

    resolveClear(undefined)

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('keeps the editor and the typed title open when renaming fails', async () => {
    mockRename.mockRejectedValueOnce(new Error('disk full'))

    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'rename-s1' }))
    fireEvent.change(screen.getByLabelText('edit-s1'), { target: { value: 'New title' } })
    fireEvent.click(screen.getByRole('button', { name: 'save-s1' }))

    await waitFor(() =>
      expect(mockRename).toHaveBeenCalledWith({ sessionId: 's1', title: 'New title' })
    )
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('api_chat_rename_failed'))

    expect(screen.getByLabelText('edit-s1')).toHaveValue('New title')
    expect(screen.getByRole('button', { name: 'save-s1' })).toBeInTheDocument()
  })

  it('disables the delete control for the session that is being deleted', async () => {
    mockConfirm.mockResolvedValue(true)
    let resolveDelete: (value: unknown) => void = () => undefined
    mockDelete.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve
      })
    )

    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'delete-s2' }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('s2'))
    expect(screen.getByRole('button', { name: 'delete-s2' })).toBeDisabled()

    await act(async () => {
      resolveDelete(undefined)
    })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'delete-s2' })).not.toBeDisabled()
    )
  })

  it('only renders the visible window of a very large history', async () => {
    mockSessions = Array.from({ length: 1000 }, (_, index) => ({
      id: `s${index}`,
      title: `Session ${index}`,
      messages: [],
      createdAt: index
    }))

    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    const renderedRows = screen.getAllByText(/^Session \d+$/)
    expect(renderedRows.length).toBeGreaterThan(0)
    expect(renderedRows.length).toBeLessThan(60)
  })

  it('keeps the row being edited mounted after scrolling it out of the virtual window', () => {
    mockSessions = Array.from({ length: 1000 }, (_, index) => ({
      id: `s${index}`,
      title: `Session ${index}`,
      messages: [],
      createdAt: index
    }))

    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'rename-s0' }))
    expect(screen.getByLabelText('edit-s0')).toBeInTheDocument()

    const list = screen.getByText('Session 0').closest('.custom-scrollbar')
    expect(list).not.toBeNull()

    fireEvent.scroll(list!, { target: { scrollTop: 5000 } })

    // The row is outside the visible slice but must not unmount: its draft,
    // validation error and focused input live there.
    expect(screen.getByLabelText('edit-s0')).toBeInTheDocument()
    // And it must exist exactly once, never duplicated over a rendered row.
    expect(screen.getAllByLabelText('edit-s0')).toHaveLength(1)
    expect(document.querySelectorAll('[data-history-row-index="0"]')).toHaveLength(1)
  })

  it('keeps an unsaved title when a search hides the edited session', () => {
    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'rename-s1' }))
    fireEvent.change(screen.getByLabelText('edit-s1'), { target: { value: 'Draft title' } })

    const search = screen.getByPlaceholderText('api_chat_modal_search_placeholder')
    fireEvent.change(search, { target: { value: 'Pharmacology' } })

    // The row is filtered out, but the draft is explicitly kept, not dropped.
    expect(screen.queryByLabelText('edit-s1')).not.toBeInTheDocument()
    expect(screen.getByText('api_chat_edit_hidden_by_search')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })

    expect(screen.getByLabelText('edit-s1')).toHaveValue('Draft title')
    expect(screen.queryByText('api_chat_edit_hidden_by_search')).not.toBeInTheDocument()
  })

  it('does not open a second editor while a rename request is in flight', async () => {
    let resolveRename: (value: unknown) => void = () => undefined
    mockRename.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRename = resolve
      })
    )

    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'rename-s1' }))
    fireEvent.change(screen.getByLabelText('edit-s1'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'save-s1' }))

    await waitFor(() =>
      expect(mockRename).toHaveBeenCalledWith({ sessionId: 's1', title: 'Renamed' })
    )

    fireEvent.click(screen.getByRole('button', { name: 'rename-s2' }))
    expect(screen.queryByLabelText('edit-s2')).not.toBeInTheDocument()
    expect(screen.getByLabelText('edit-s1')).toBeInTheDocument()

    await act(async () => {
      resolveRename(undefined)
    })
  })

  it('opens only one confirmation when delete is triggered twice for the same row', async () => {
    let resolveConfirm: (value: boolean) => void = () => undefined
    mockConfirm.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveConfirm = resolve
      })
    )

    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    const remove = screen.getByRole('button', { name: 'delete-s1' })
    act(() => {
      remove.click()
      remove.click()
    })

    expect(mockConfirm).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveConfirm(false)
    })

    // The lock is released after the dialog resolves, so a later attempt works.
    mockConfirm.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: 'delete-s1' }))
    expect(mockConfirm).toHaveBeenCalledTimes(2)
  })

  it('moves keyboard focus into the next virtual page instead of leaving the list', async () => {
    mockSessions = Array.from({ length: 1000 }, (_, index) => ({
      id: `s${index}`,
      title: `Session ${index}`,
      messages: [],
      createdAt: index
    }))

    render(<HistoryModal isOpen onClose={vi.fn()} tabId="tab-1" />)

    // The mock row renders rename then delete, so the last delete is also the
    // last focusable element inside the scroll container.
    const lastFocusable = screen
      .getAllByRole('button', { name: /^delete-s\d+$/ })
      .at(-1) as HTMLElement
    const lastRenderedIndex = Number(
      lastFocusable.closest('[data-history-row-index]')?.getAttribute('data-history-row-index')
    )
    const nextIndex = lastRenderedIndex + 1

    act(() => {
      lastFocusable.focus()
    })
    fireEvent.keyDown(lastFocusable, { key: 'Tab' })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: `rename-s${nextIndex}` })).toHaveFocus()
    )
  })
})
