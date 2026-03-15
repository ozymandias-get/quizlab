import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeminiCliTab from '@features/settings/ui/GeminiCliTab'

const {
  mockShowError,
  mockRefreshAuth,
  mockOpenExternal,
  mockOpenLogin,
  mockLogout,
  mockUseCheckAuth,
  mockUseCliPath
} = vi.hoisted(() => ({
  mockShowError: vi.fn(),
  mockRefreshAuth: vi.fn(),
  mockOpenExternal: vi.fn(),
  mockOpenLogin: vi.fn(),
  mockLogout: vi.fn(),
  mockUseCheckAuth: vi.fn(),
  mockUseCliPath: vi.fn()
}))

vi.mock('@app/providers', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
  useToast: () => ({ showError: mockShowError })
}))

vi.mock('@platform/electron/api/useQuizApi', () => ({
  useCliPath: () => mockUseCliPath(),
  useCheckAuth: () => mockUseCheckAuth(),
  useOpenLogin: () => ({ mutateAsync: mockOpenLogin, isPending: false }),
  useLogout: () => ({ mutateAsync: mockLogout, isPending: false })
}))

vi.mock('@platform/electron/api/useSystemApi', () => ({
  useOpenExternal: () => ({ mutate: mockOpenExternal })
}))

vi.mock('@ui/components/Icons', () => ({
  TerminalIcon: ({ className }: { className?: string }) => (
    <span className={className}>TerminalIcon</span>
  ),
  CheckIcon: ({ className }: { className?: string }) => (
    <span className={className}>CheckIcon</span>
  ),
  XIcon: ({ className }: { className?: string }) => <span className={className}>XIcon</span>,
  LoaderIcon: ({ className }: { className?: string }) => (
    <span className={className}>LoaderIcon</span>
  ),
  ExternalLinkIcon: ({ className }: { className?: string }) => (
    <span className={className}>ExternalLinkIcon</span>
  ),
  GoogleIcon: ({ className }: { className?: string }) => (
    <span className={className}>GoogleIcon</span>
  ),
  RefreshIcon: ({ className }: { className?: string }) => (
    <span className={className}>RefreshIcon</span>
  )
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    )
  }
}))

describe('GeminiCliTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCliPath.mockReturnValue({ data: { path: '/cli', exists: true }, isLoading: false })
    mockUseCheckAuth.mockReturnValue({
      data: { authenticated: false, account: null },
      isLoading: false,
      isRefetching: false,
      refetch: mockRefreshAuth
    })
    mockOpenLogin.mockResolvedValue({ success: true })
    mockLogout.mockResolvedValue({ success: true })
  })

  it('shows a loading state while the CLI path is loading', () => {
    mockUseCliPath.mockReturnValue({ data: undefined, isLoading: true })

    render(<GeminiCliTab />)

    expect(screen.getByText('LoaderIcon')).toBeInTheDocument()
    expect(screen.queryByText('gcli_login_btn')).not.toBeInTheDocument()
  })

  it('renders unauthenticated actions and handles login, refresh, and docs', async () => {
    render(<GeminiCliTab />)

    expect(screen.getByText('gcli_login_required')).toBeInTheDocument()
    expect(screen.getByText('gcli_step1_title')).toBeInTheDocument()
    expect(screen.getByText('gcli_step2_title')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /gcli_login_btn/i }))
    fireEvent.click(screen.getByRole('button', { name: /gcli_check_status/i }))
    fireEvent.click(screen.getByRole('button', { name: /gcli_about_btn/i }))

    await waitFor(() => {
      expect(mockOpenLogin).toHaveBeenCalledTimes(1)
    })

    expect(mockRefreshAuth).toHaveBeenCalledTimes(1)
    expect(mockOpenExternal).toHaveBeenCalledWith('https://github.com/google-gemini/gemini-cli')
  })

  it('surfaces login errors returned by the login mutation', async () => {
    mockOpenLogin.mockResolvedValue({ success: false, error: 'login failed' })

    render(<GeminiCliTab />)
    fireEvent.click(screen.getByRole('button', { name: /gcli_login_btn/i }))

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('login failed')
    })
  })

  it('renders the connected account and allows logout when authenticated', async () => {
    mockUseCheckAuth.mockReturnValue({
      data: { authenticated: true, account: 'user@example.com' },
      isLoading: false,
      isRefetching: false,
      refetch: mockRefreshAuth
    })

    render(<GeminiCliTab />)

    expect(screen.getByText('gcli_account_connected')).toBeInTheDocument()
    expect(screen.getByText('gcli_connected_account')).toBeInTheDocument()
    expect(screen.getByText('user@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /gcli_logout_btn/i }))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
  })
})
