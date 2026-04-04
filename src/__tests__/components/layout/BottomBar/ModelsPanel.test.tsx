import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelsPanel } from '@ui/layout/BottomBar/ModelsPanel'

const mockSetEnabledModels = vi.fn()
const mockAddTab = vi.fn()

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  Reorder: {
    Group: ({ children, onReorder, values, ...props }: any) => <div {...props}>{children}</div>
  }
}))

vi.mock('@app/providers', () => ({
  useLanguage: () => ({
    t: (key: string) => key
  }),
  useLanguageStrings: () => ({ t: (key: string) => key, language: 'en' })
}))

vi.mock('@app/providers/AiContext', () => ({
  useAiModelsCatalog: () => ({
    enabledModels: ['chatgpt', 'gemini', 'youtube'],
    defaultAiModel: 'chatgpt',
    aiSites: {
      chatgpt: { icon: 'chatgpt', displayName: 'ChatGPT' },
      gemini: { icon: 'gemini', displayName: 'Gemini' },
      youtube: { icon: 'youtube', displayName: 'YouTube' }
    }
  }),
  useAiCoreWorkspaceActions: () => ({
    addTab: mockAddTab,
    setEnabledModels: mockSetEnabledModels
  })
}))

vi.mock('@ui/layout/BottomBar/AIItem', () => ({
  AIItem: ({ modelKey }: { modelKey: string }) => <div>{modelKey}</div>
}))

vi.mock('@ui/layout/BottomBar/animations', () => ({
  panelVariantsVertical: {},
  panelTransition: {}
}))

describe('ModelsPanel', () => {
  beforeEach(() => {
    mockAddTab.mockReset()
    mockSetEnabledModels.mockReset()
  })

  it('renders a bounded scroll area instead of growing with the list', () => {
    render(<ModelsPanel isOpen panelStyle={{}} showOnlyIcons />)

    const scrollArea = screen.getByTestId('models-panel-scroll-area')
    expect(scrollArea).toHaveClass('overflow-y-auto')
    expect(scrollArea).toHaveClass('scrollbar-hidden')
    expect(scrollArea).toHaveStyle({ maxHeight: 'min(52vh, 24rem)' })
  })

  it('hides the bottom scroll cue after the user reaches the end of the list', async () => {
    render(<ModelsPanel isOpen panelStyle={{}} maxHeight={100} showOnlyIcons />)

    const scrollArea = screen.getByTestId('models-panel-scroll-area')

    Object.defineProperty(scrollArea, 'clientHeight', {
      configurable: true,
      value: 100
    })
    Object.defineProperty(scrollArea, 'scrollHeight', {
      configurable: true,
      value: 240
    })
    Object.defineProperty(scrollArea, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0
    })

    fireEvent(window, new Event('resize'))

    await waitFor(() => {
      expect(screen.getByTestId('models-panel-scroll-cue')).toBeInTheDocument()
    })

    Object.defineProperty(scrollArea, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 140
    })

    fireEvent.scroll(scrollArea)

    await waitFor(() => {
      expect(screen.queryByTestId('models-panel-scroll-cue')).not.toBeInTheDocument()
    })
  })
})
