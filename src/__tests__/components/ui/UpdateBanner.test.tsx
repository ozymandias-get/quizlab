import UpdateBanner from '@app/components/UpdateBanner'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ui/components/Icons', () => ({
  UpdateIcon: () => <div data-testid="icon-update" />,
  CloseIcon: () => <div data-testid="icon-close" />,
  DownloadIcon: () => <div data-testid="icon-download" />
}))

const mockOpenExternal = vi.fn()
vi.mock('@platform/electron/api/useSystemApi', () => ({
  useOpenExternal: () => ({ mutate: mockOpenExternal, isPending: false })
}))

const t = (key: string) => key

describe('UpdateBanner', () => {
  const defaultProps = {
    updateAvailable: true,
    updateInfo: { version: '1.2.3', releaseName: 'Cool Update' } as unknown as React.ComponentProps<
      typeof UpdateBanner
    >['updateInfo'],
    isVisible: true,
    onClose: vi.fn(),
    t
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the released version and name', () => {
    render(<UpdateBanner {...defaultProps} />)

    expect(screen.getByText('update_available')).toBeInTheDocument()
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
    expect(screen.getByText('Cool Update')).toBeInTheDocument()
  })

  it.each([
    ['it is not visible', { isVisible: false }],
    ['there is no update info', { updateInfo: null }]
  ])('renders nothing when %s', (_label, props) => {
    const { container } = render(<UpdateBanner {...defaultProps} {...props} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('calls onClose from either dismiss control', () => {
    for (const trigger of [
      () => screen.getByTestId('icon-close').closest('button')!,
      () => screen.getByText('later')
    ]) {
      const onClose = vi.fn()
      const { unmount } = render(<UpdateBanner {...defaultProps} onClose={onClose} />)

      fireEvent.click(trigger())
      expect(onClose).toHaveBeenCalledTimes(1)
      unmount()
    }
  })

  it('opens the releases page, never the renderer, on download', async () => {
    render(<UpdateBanner {...defaultProps} />)
    fireEvent.click(screen.getByText('download_from_github'))
    // A download link that navigated the renderer would leave the app entirely;
    // the OS has to be asked.
    expect(mockOpenExternal).toHaveBeenCalledWith(
      'https://github.com/ozymandias-get/quizlab/releases/latest'
    )
  })
})
