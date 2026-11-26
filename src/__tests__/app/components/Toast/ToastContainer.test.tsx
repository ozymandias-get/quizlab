import ToastContainer from '@app/components/Toast/ToastContainer'

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const TOASTS = [
  {
    id: 'e1',
    type: 'error' as const,
    message: 'error_message',
    title: 'toast.error.title',
    duration: 60000,
    createdAt: 1
  },
  {
    id: 's1',
    type: 'success' as const,
    message: 'success_message',
    title: 'toast.success.title',
    duration: 60000,
    createdAt: 2
  }
]

const toastState = vi.hoisted(() => ({
  list: [] as Array<{
    id: string
    type: 'error' | 'success' | 'info'
    message: string
    title?: string
    duration?: number
    createdAt: number
  }>
}))

vi.mock('@app/providers', () => ({
  useToastList: () => ({ toasts: toastState.list, removeToast: vi.fn() })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    )
  }
}))

vi.mock('@app/components/Toast/ToastItem', () => ({
  default: ({ toast, paused }: { toast: { message: string }; paused?: boolean }) => (
    <div data-testid={`toast-card-${toast.message}`} data-paused={paused ? 'true' : 'false'}>
      {toast.message}
    </div>
  )
}))

describe('ToastContainer', () => {
  it('announces errors assertively and keeps other toasts polite', () => {
    toastState.list = TOASTS
    render(<ToastContainer />)

    const errorRegion = screen.getByTestId('toast-region-error')
    expect(errorRegion).toHaveAttribute('role', 'alert')
    expect(errorRegion).toHaveAttribute('aria-live', 'assertive')
    expect(within(errorRegion).getByText('error_message')).toBeInTheDocument()

    const politeRegion = screen.getByTestId('toast-region-polite')
    expect(politeRegion).toHaveAttribute('role', 'status')
    expect(politeRegion).toHaveAttribute('aria-live', 'polite')
    expect(within(politeRegion).getByText('success_message')).toBeInTheDocument()
  })

  it('lets only the front card of a deck receive pointer events', () => {
    toastState.list = ['one', 'two', 'three'].map((message, index) => ({
      id: message,
      type: 'info' as const,
      message,
      duration: 60000,
      createdAt: index + 1
    }))
    render(<ToastContainer />)

    const region = screen.getByTestId('toast-region-polite')
    const wrappers = [...region.querySelectorAll<HTMLElement>('div.grid > div')]
    // The newest toast is last and sits in front; the two behind it must be
    // transparent to the pointer so their visible sliver cannot be hovered.
    expect(wrappers).toHaveLength(3)
    expect(wrappers.map((wrapper) => wrapper.style.pointerEvents)).toEqual(['none', 'none', 'auto'])
    // Only the front card runs its timer; the two behind it are paused too.
    expect(wrappers[0].firstElementChild).toHaveAttribute('data-paused', 'true')
    expect(wrappers[1].firstElementChild).toHaveAttribute('data-paused', 'true')
    expect(wrappers[2].firstElementChild).toHaveAttribute('data-paused', 'false')
  })
})
