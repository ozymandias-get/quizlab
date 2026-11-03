import ToastContainer from '@app/components/Toast/ToastContainer'

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const TOASTS = [
  {
    id: 'e1',
    type: 'error',
    message: 'error_message',
    title: 'toast.error.title',
    duration: 60000,
    createdAt: 1
  },
  {
    id: 's1',
    type: 'success',
    message: 'success_message',
    title: 'toast.success.title',
    duration: 60000,
    createdAt: 2
  }
]

vi.mock('@app/providers', () => ({
  useToastList: () => ({ toasts: TOASTS, removeToast: vi.fn() })
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
  default: ({ toast }: { toast: { message: string } }) => <div>{toast.message}</div>
}))

describe('ToastContainer', () => {
  it('announces errors assertively and keeps other toasts polite', () => {
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

  it('leaves room for its right offset in narrow windows', () => {
    render(<ToastContainer />)

    const root = document.getElementById('toast-root')
    expect(root?.className).toContain('w-[calc(100vw-2rem)]')
    expect(root?.className).toContain('max-w-[420px]')
  })
})
