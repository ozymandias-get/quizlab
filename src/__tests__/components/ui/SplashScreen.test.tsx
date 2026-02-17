import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import SplashScreen from '@src/components/ui/SplashScreen/index'

// Mock useLanguage
vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('SplashScreen Component', () => {
    const onFinish = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders splash screen initially', () => {
        render(<SplashScreen onFinish={onFinish} />)
        expect(screen.getByText('app_name')).toBeInTheDocument()
        expect(screen.getByText('splash_initializing')).toBeInTheDocument()
    })

    it('calls onFinish after duration and animation', () => {
        render(<SplashScreen onFinish={onFinish} />)

        // Initial delay (3000ms)
        act(() => {
            vi.advanceTimersByTime(3000)
        })

        // Animation exit delay (800ms)
        act(() => {
            vi.advanceTimersByTime(800)
        })

        expect(onFinish).toHaveBeenCalled()
    })
})
