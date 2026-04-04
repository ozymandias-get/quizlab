import type { ComponentProps, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import UpdatesCard from '@features/settings/ui/about/UpdatesCard'

vi.mock('@ui/components/Icons', () => ({
  RefreshIcon: ({ className }: { className?: string }) => (
    <span className={className}>RefreshIcon</span>
  ),
  InfoIcon: ({ className }: { className?: string }) => <span className={className}>InfoIcon</span>,
  DownloadIcon: ({ className }: { className?: string }) => (
    <span className={className}>DownloadIcon</span>
  ),
  LoaderIcon: ({ className }: { className?: string }) => (
    <span className={className}>LoaderIcon</span>
  )
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, initial, animate, exit, transition, ...props }: any) => (
      <span {...props}>{children}</span>
    )
  }
}))

describe('UpdatesCard', () => {
  const createProps = (overrides: Partial<ComponentProps<typeof UpdatesCard>> = {}) => ({
    updateStatus: 'idle' as const,
    updateInfo: null,
    t: (key: string) => key,
    handleStartTour: vi.fn(),
    checkForUpdates: vi.fn(async () => undefined),
    openReleasesPage: vi.fn(async () => undefined),
    ...overrides
  })

  it('shows the idle status and check button', () => {
    const props = createProps()

    render(<UpdatesCard {...props} />)

    expect(screen.getByText('update_not_available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /usage_assistant_start/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /check_for_updates/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /download_from_github/i })).not.toBeInTheDocument()
  })

  it('shows the available status and opens the releases page', () => {
    const props = createProps({
      updateStatus: 'available',
      updateInfo: { available: true, version: '2.0.0', releaseName: 'Launch Notes' }
    })

    render(<UpdatesCard {...props} />)

    expect(screen.getByText('update_available')).toBeInTheDocument()
    expect(screen.getByText('2.0.0')).toBeInTheDocument()
    expect(screen.getByText('"Launch Notes"')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check_for_updates/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /download_from_github/i }))

    expect(props.openReleasesPage).toHaveBeenCalledTimes(1)
  })

  it('keeps the tour action and refresh action callable for latest status', () => {
    const props = createProps({ updateStatus: 'latest' })

    render(<UpdatesCard {...props} />)

    expect(screen.getByText('you_have_latest')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /usage_assistant_start/i }))
    fireEvent.click(screen.getByRole('button', { name: /check_for_updates/i }))

    expect(props.handleStartTour).toHaveBeenCalledTimes(1)
    expect(props.checkForUpdates).toHaveBeenCalledTimes(1)
  })
})
