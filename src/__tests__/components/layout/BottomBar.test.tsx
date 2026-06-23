import BottomBar from '@ui/layout/BottomBar/index'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@app/providers', () => ({
  useAppearance: () => ({
    bottomBarOpacity: 1,
    bottomBarScale: 1,
    toggleLayoutSwap: vi.fn(),
    visibleTools: {
      'tour-target-tool-settings': true,
      'tour-target-tool-swap': true,
      'tour-target-tool-pdf-focus': true,
      'tour-target-tool-ai-focus': true,
      'tour-target-tool-picker': true
    },
    visibleModels: {}
  }),
  useAppToolActions: () => ({
    togglePicker: vi.fn(),
    startPickerWhenReady: vi.fn()
  }),
  useAppToolPickerState: () => ({ isPickerActive: false })
}))

vi.mock('@app/providers/AiContext', () => ({
  useAiTabsList: () => ({ tabs: [] }),
  useAiModelsCatalog: () => ({ enabledModels: [], aiSites: {} }),
  useAiTabActions: () => ({ openAiWorkspace: vi.fn() })
}))

vi.mock('@platform/electron/api/useGeminiWebSessionApi', () => ({
  useGeminiWebStatus: () => ({ data: null, isLoading: false })
}))

vi.mock('@features/pdf', () => ({
  usePdfSelection: () => ({ pdfFile: null, activePdfTab: null })
}))

vi.mock('@ui/layout/BottomBar/SettingsLoadingSpinner', () => ({
  SettingsLoadingSpinner: () => <div>Loading...</div>
}))

vi.mock('@ui/layout/BottomBar/SettingsModalPortal', () => ({
  default: ({ isOpen, onClose, initialTab }: any) =>
    isOpen ? (
      <div data-testid="settings-modal">
        Settings Modal Content
        <span>{initialTab}</span>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null
}))

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    createPortal: (node: any) => node
  }
})

vi.mock('@ui/components/Icons', () => ({
  AiHubIcon: (props: any) => <svg {...props} data-testid="ai-hub" />,
  SettingsIcon: (props: any) => <svg {...props} data-testid="settings-icon" />,
  SwapIcon: (props: any) => <svg {...props} data-testid="swap-icon" />,
  ExpandIcon: (props: any) => <svg {...props} data-testid="expand-icon" />,
  SparklesExpandIcon: (props: any) => <svg {...props} data-testid="sparkles-expand-icon" />,
  MagicWandIcon: (props: any) => <svg {...props} data-testid="magic-wand" />,
  GeminiIcon: (props: any) => <svg {...props} data-testid="gemini-icon" />,
  LoaderIcon: (props: any) => <svg {...props} data-testid="loader-icon" />,
  getAiIcon: () => null
}))

vi.mock('@app/components/ui/sparkles', () => ({
  SparklesCore: () => <div data-testid="sparkles-core" />,
  default: () => <div data-testid="sparkles-core" />
}))

vi.mock('motion/react', () => {
  const filterProps = (props: any) => {
    const {
      whileHover,
      whileTap,
      initial,
      animate,
      exit,
      transition,
      variants,
      custom,
      mode,
      layout,
      ...rest
    } = props
    return rest
  }

  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...filterProps(props)}>{children}</div>,
      button: ({ children, ...props }: any) => <button {...filterProps(props)}>{children}</button>,
      span: ({ children, ...props }: any) => <span {...filterProps(props)}>{children}</span>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
    useMotionValue: (initial: any) => ({ get: () => initial, set: vi.fn(), onChange: vi.fn() }),
    useSpring: (val: any) => val,
    useTransform: () => ({ get: () => 32, set: vi.fn() })
  }
})

describe('BottomBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the resizer hub container', () => {
    const { container } = render(<BottomBar />)
    const hub = container.querySelector('.resizer-hub-container')
    expect(hub).toBeInTheDocument()
  })

  it('renders resizer drag areas with compare visual elements', () => {
    const { container } = render(<BottomBar />)
    const dragAreas = container.querySelectorAll('.resizer-drag-area')
    expect(dragAreas.length).toBe(2)
    const sparkles = screen.getAllByTestId('sparkles-core')
    expect(sparkles.length).toBe(2)
  })

  it('renders the gradient line and handlebar in each drag area', () => {
    const { container } = render(<BottomBar />)
    const gradientLines = container.querySelectorAll(
      '[class*="bg-gradient-to-b from-transparent via-white"]'
    )
    expect(gradientLines.length).toBe(2)
    const dotIcons = container.querySelectorAll('.tabler-icon-dots-vertical')
    expect(dotIcons.length).toBe(2)
  })

  it('renders settings icon in floating dock inner', () => {
    render(<BottomBar />)
    expect(screen.getByTestId('settings-icon')).toBeInTheDocument()
  })

  it('fires onMouseDown when drag area is clicked', () => {
    const onMouseDown = vi.fn()
    const { container } = render(<BottomBar onMouseDown={onMouseDown} />)
    const dragAreas = container.querySelectorAll('.resizer-drag-area')
    fireEvent.mouseDown(dragAreas[0])
    expect(onMouseDown).toHaveBeenCalledTimes(1)
  })

  it('fires onHoverChange on mouse enter/leave', () => {
    const onHoverChange = vi.fn()
    const { container } = render(<BottomBar onHoverChange={onHoverChange} />)
    const hub = container.querySelector('.resizer-hub-container')!
    fireEvent.mouseEnter(hub)
    expect(onHoverChange).toHaveBeenCalledWith(true)
    fireEvent.mouseLeave(hub)
    expect(onHoverChange).toHaveBeenCalledWith(false)
  })
})
