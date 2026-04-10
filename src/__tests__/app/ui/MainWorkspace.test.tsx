import { createRef, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MainWorkspace from '@app/ui/MainWorkspace'

vi.mock('@features/ai', () => ({
  AiWebview: () => <div data-testid="ai-webview">AI Webview</div>
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

describe('MainWorkspace', () => {
  it('applies the primary glass tier to the right workspace panel', () => {
    const leftPanelRef = createRef<HTMLDivElement>() as RefObject<HTMLDivElement>
    const resizerRef = createRef<HTMLDivElement>() as RefObject<HTMLDivElement>

    render(
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
        handleMouseDown={vi.fn()}
        isWebviewMounted={true}
        isResizing={false}
        isBarHovered={false}
        onBarHoverChange={vi.fn()}
        leftPanelProps={{} as never}
      />
    )

    expect(screen.getByTestId('ai-webview').parentElement).toHaveClass('glass-tier-1')
  })
})
