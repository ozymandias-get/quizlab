import MainWorkspace from '@app/ui/MainWorkspace'

import { render, screen } from '@testing-library/react'
import { createRef, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'

// NOTE: AiViewSurface is mocked because it is lazy-loaded. Assertions below only
// cover DOM rendered by MainWorkspace itself — never the mock's own markup,
// otherwise the test would pass even if MainWorkspace broke (tautology).
vi.mock('@features/ai/aiViewSurface', () => ({
  AiViewSurface: () => <div data-testid="ai-content">AI Content</div>
}))

vi.mock('@ui/layout/BottomBar', () => ({
  default: () => <div data-testid="bottom-bar">Bottom Bar</div>
}))

vi.mock('@ui/components/AestheticLoader', () => ({
  default: () => <div data-testid="aesthetic-loader">Loading</div>
}))

vi.mock('@ui/layout/LeftPanel', () => ({
  default: () => <div data-testid="left-panel">Left Panel</div>
}))

function renderWorkspace(props?: Partial<React.ComponentProps<typeof MainWorkspace>>) {
  const leftPanelRef = createRef<HTMLDivElement>() as RefObject<HTMLDivElement>
  const resizerRef = createRef<HTMLDivElement>() as RefObject<HTMLDivElement>

  return render(
    <MainWorkspace
      isLayoutSwapped={false}
      leftPanelWidth={50}
      leftPanelRef={leftPanelRef}
      resizerRef={resizerRef}
      containerVariants={{}}
      leftPanelVariants={{}}
      rightPanelVariants={{}}
      resizerVariants={{}}
      gpuAcceleratedStyle={{}}
      handlePointerDown={vi.fn()}
      handlePointerMove={vi.fn()}
      handlePointerUp={vi.fn()}
      handleLostPointerCapture={vi.fn()}
      isAiSurfaceMounted
      isResizing={false}
      onBarHoverChange={vi.fn()}
      leftPanelProps={{} as never}
      bgMode="solid"
      isAiSurfaceActive
      aiViewSurfaceState={{
        aliveTabIds: [],
        showHome: true,
        showHideHome: { show: vi.fn(), hide: vi.fn() },
        coldTabIds: new Set<string>(),
        recordTabUrl: vi.fn(),
        getRestoredUrl: () => undefined
      }}
      {...props}
    />
  )
}

describe('MainWorkspace', () => {
  it('renders the real left/right workspace panels', () => {
    const { container } = renderWorkspace()

    // Tour targets are rendered by MainWorkspace itself (not by mocks).
    expect(container.querySelector('[data-tour-id="tour-target-left-panel"]')).not.toBeNull()
    expect(container.querySelector('[data-tour-id="tour-target-right-panel"]')).not.toBeNull()
    expect(screen.getByTestId('left-panel')).toBeInTheDocument()
  })

  it('lays panels out left-to-right by default, reversed when swapped', () => {
    const normal = renderWorkspace()
    const main = normal.container.querySelector('main')
    expect(main?.className).toMatch(/(^|\s)flex-row(\s|$)/)
    expect(main?.className).not.toContain('flex-row-reverse')
    normal.unmount()

    const swapped = renderWorkspace({ isLayoutSwapped: true })
    expect(swapped.container.querySelector('main')?.className).toContain('flex-row-reverse')
  })

  it('shows the loader instead of the content when it is not mounted', () => {
    renderWorkspace({ isAiSurfaceMounted: false })

    expect(screen.getByTestId('aesthetic-loader')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-content')).not.toBeInTheDocument()
  })
})
