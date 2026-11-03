import HistoryModal from '@features/ai/ui/chat/HistoryModal'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockClearAll = vi.fn()
const mockConfirm = vi.fn()
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
  useSessionsQuery: () => ({ data: SESSIONS }),
  useDeleteSessionMutation: () => ({ mutate: vi.fn() }),
  useRenameSessionMutation: () => ({ mutate: vi.fn() }),
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
  default: ({ session }: { session: { title: string } }) => <div>{session.title}</div>
}))

describe('HistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    fireEvent.change(screen.getByPlaceholderText('api_chat_modal_search_placeholder'), {
      target: { value: 'lupus' }
    })

    expect(screen.getByText('Cardiology notes')).toBeInTheDocument()
    expect(screen.queryByText('Pharmacology')).not.toBeInTheDocument()
    expect(SESSIONS).toHaveLength(2)
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
})
