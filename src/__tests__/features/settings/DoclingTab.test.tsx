import DoclingTab from '@features/settings/ui/DoclingTab'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const mockState = vi.hoisted(() => ({
  docling: null as unknown,
  serviceStatus: null as unknown,
  isLoading: false,
  isBusy: false,
  isInstalled: false,
  progress: null as unknown,
  confirmOpen: false,
  actionPending: false,
  handleRefresh: vi.fn(),
  handleInstall: vi.fn(),
  handleRepair: vi.fn(),
  handleRemove: vi.fn(),
  closeConfirm: vi.fn(),
  confirmRemove: vi.fn()
}))

vi.mock('@features/settings/ui/docling/useDoclingTabState', () => ({
  useDoclingTabState: () => mockState
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

describe('DoclingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.docling = null
    mockState.serviceStatus = null
    mockState.isLoading = false
    mockState.isBusy = false
    mockState.isInstalled = false
    mockState.progress = null
    mockState.confirmOpen = false
    mockState.actionPending = false
  })

  it('shows install button when not installed', () => {
    mockState.docling = { status: 'not_installed', version: null, error: null } as never
    mockState.isInstalled = false
    renderWithQueryClient(<DoclingTab />)
    expect(screen.getByText('docling_install')).toBeInTheDocument()
    expect(screen.queryByText('docling_remove')).not.toBeInTheDocument()
  })

  it('shows repair and remove when installed', () => {
    mockState.docling = { status: 'installed', version: '0.1.0', error: null } as never
    mockState.isInstalled = true
    mockState.serviceStatus = {
      state: 'stopped',
      diskUsageBytes: 12345,
      modelStatus: 'ready'
    } as never
    renderWithQueryClient(<DoclingTab />)
    expect(screen.getByText('docling_repair')).toBeInTheDocument()
    expect(screen.getByText('docling_remove')).toBeInTheDocument()
    expect(screen.queryByText('docling_install')).not.toBeInTheDocument()
  })

  it('triggers install', () => {
    mockState.docling = { status: 'not_installed', version: null, error: null } as never
    renderWithQueryClient(<DoclingTab />)
    fireEvent.click(screen.getByText('docling_install'))
    expect(mockState.handleInstall).toHaveBeenCalled()
  })

  it('opens confirmation on remove', () => {
    mockState.docling = { status: 'installed', version: '0.1.0', error: null } as never
    mockState.isInstalled = true
    renderWithQueryClient(<DoclingTab />)
    fireEvent.click(screen.getByText('docling_remove'))
    expect(mockState.handleRemove).toHaveBeenCalled()
  })

  it('shows error alert when error present', () => {
    mockState.docling = { status: 'error', version: null, error: 'disk full' } as never
    mockState.serviceStatus = null
    renderWithQueryClient(<DoclingTab />)
    expect(screen.getByText('disk full')).toBeInTheDocument()
    expect(screen.getByText('docling_last_error')).toBeInTheDocument()
  })

  it('disables buttons while busy', () => {
    mockState.docling = { status: 'installing', version: null, error: null } as never
    mockState.isBusy = true
    mockState.isInstalled = false
    renderWithQueryClient(<DoclingTab />)
    expect(screen.getByText('docling_install').closest('button')).toBeDisabled()
  })

  it('shows progress phase when busy', () => {
    mockState.docling = { status: 'installing', version: null, error: null } as never
    mockState.isBusy = true
    mockState.progress = { phase: 'downloading_runtime', percent: 42 } as never
    renderWithQueryClient(<DoclingTab />)
    expect(screen.getByTestId('docling-progress-phase')).toHaveTextContent('downloading_runtime')
    expect(screen.getByTestId('docling-progress')).toBeInTheDocument()
  })
})
