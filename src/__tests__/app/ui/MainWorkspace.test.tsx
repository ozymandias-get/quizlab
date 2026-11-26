import { useAppAnimations } from '@app/hooks/useAppAnimations'
import MainWorkspace from '@app/ui/MainWorkspace'

import { render, screen, waitFor } from '@testing-library/react'
import { AnimatePresence } from 'motion/react'
import { createRef, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'

// NOTE: AiViewSurface is mocked because it is lazy-loaded. Assertions below only
// cover DOM rendered by MainWorkspace itself — never the mock's own markup,
// otherwise the test would pass even if MainWorkspace broke (tautology).
vi.mock('@features/ai/aiViewSurface', () => ({
  AiViewSurface: () => <div data-testid="ai-content">AI Content</div>
}))

vi.mock('@app/ui/BottomBar', () => ({
  default: () => <div data-testid="bottom-bar">Bottom Bar</div>
}))

vi.mock('@ui/components/PanelLoadingPlaceholder', () => ({
  default: () => <div data-testid="panel-loading-placeholder" />
}))

vi.mock('@ui/layout/LeftPanel', () => ({
  default: () => <div data-testid="left-panel">Left Panel</div>
}))

function workspaceProps(
  props?: Partial<React.ComponentProps<typeof MainWorkspace>>
): React.ComponentProps<typeof MainWorkspace> {
  const leftPanelRef = createRef<HTMLDivElement>() as RefObject<HTMLDivElement>
  const resizerRef = createRef<HTMLDivElement>() as RefObject<HTMLDivElement>

  return {
    isLayoutSwapped: false,
    leftPanelWidth: 50,
    leftPanelRef,
    resizerRef,
    containerVariants: {},
    leftPanelVariants: {},
    rightPanelVariants: {},
    resizerVariants: {},
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerUp: vi.fn(),
    handleLostPointerCapture: vi.fn(),
    isAiSurfaceMounted: true,
    isResizing: false,
    leftPanelProps: {} as never,
    isAiSurfaceActive: true,
    aiViewSurfaceState: {
      aliveTabIds: [],
      showHome: true,
      showHideHome: { show: vi.fn(), hide: vi.fn() },
      coldTabIds: new Set<string>(),
      recordTabUrl: vi.fn(),
      getRestoredUrl: () => undefined,
      tabUrlRequests: {},
      requestTabUrl: vi.fn(),
      clearTabUrlRequest: vi.fn()
    },
    ...props
  }
}

function renderWorkspace(props?: Partial<React.ComponentProps<typeof MainWorkspace>>) {
  return render(<MainWorkspace {...workspaceProps(props)} />)
}

/** The shell's focus handoff: the workspace is the exiting child of an `AnimatePresence`. */
function WorkspaceHandoff({ isWorkspaceVisible }: { isWorkspaceVisible: boolean }) {
  const animations = useAppAnimations()

  return (
    <AnimatePresence initial={false}>
      {isWorkspaceVisible && (
        <div key="workspace">
          <MainWorkspace
            {...workspaceProps({
              containerVariants: animations.containerVariants,
              leftPanelVariants: animations.leftPanelVariants,
              rightPanelVariants: animations.rightPanelVariants,
              resizerVariants: animations.resizerVariants
            })}
          />
        </div>
      )}
    </AnimatePresence>
  )
}

describe('MainWorkspace', () => {
  it('lays panels out left-to-right by default, reversed when swapped', () => {
    const normal = renderWorkspace()
    const main = normal.container.querySelector('main')
    expect(main?.className).toMatch(/(^|\s)flex-row(\s|$)/)
    expect(main?.className).not.toContain('flex-row-reverse')
    normal.unmount()

    const swapped = renderWorkspace({ isLayoutSwapped: true })
    expect(swapped.container.querySelector('main')?.className).toContain('flex-row-reverse')
  })

  it('shows the neutral placeholder instead of the content when it is not mounted', () => {
    renderWorkspace({ isAiSurfaceMounted: false })

    expect(screen.getByTestId('panel-loading-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-content')).not.toBeInTheDocument()
  })

  it('exits on focus handoff and unmounts instead of being stranded under the overlay', async () => {
    const { rerender } = render(<WorkspaceHandoff isWorkspaceVisible />)

    rerender(<WorkspaceHandoff isWorkspaceVisible={false} />)

    // The panels are kept for the exit animation ...
    expect(screen.getByTestId('left-panel')).toBeInTheDocument()
    expect(screen.getByTestId('ai-content')).toBeInTheDocument()

    // ... and then released, so focus mode never runs with two live surfaces.
    await waitFor(() => {
      expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument()
    })
  })
})
