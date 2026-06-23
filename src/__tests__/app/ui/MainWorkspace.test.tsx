import MainWorkspace from '@app/ui/MainWorkspace'

import { render, screen, waitFor } from '@testing-library/react'
import { createRef, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@features/ai/webview', () => ({
  AiWebview: () => (
    <div className="glass-tier-1 panel-3d-right" data-testid="ai-webview">
      AI Webview
    </div>
  )
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
  it('applies the primary glass tier to the right workspace panel', async () => {
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
        isWebviewMounted
        isResizing={false}
        isBarHovered={false}
        onBarHoverChange={vi.fn()}
        leftPanelProps={{} as never}
        bgMode="solid"
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('ai-webview')).toHaveClass('glass-tier-1')
    })
  })
})
