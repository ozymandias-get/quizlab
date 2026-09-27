import type { AiDraftImageItem } from '@app/providers/ai/types'

import AttachmentStrip from '@app/ui/aiSendComposer/AttachmentStrip'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function image(overrides: Partial<AiDraftImageItem> = {}): AiDraftImageItem {
  return { id: 'img-1', type: 'image', ...overrides }
}

describe('AttachmentStrip', () => {
  it('renders nothing when there are no images', () => {
    const { container } = render(<AttachmentStrip images={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a preview for each queued image', () => {
    render(
      <AttachmentStrip
        images={[image({ id: 'a', blobUrl: 'blob:one' }), image({ id: 'b', blobUrl: 'blob:two' })]}
      />
    )
    const previews = screen.getAllByTestId('ai-send-attachment-preview')
    expect(previews).toHaveLength(2)
    expect(previews[0]).toHaveAttribute('src', 'blob:one')
    expect(previews[1]).toHaveAttribute('src', 'blob:two')
  })

  it('prefers the lightweight blob URL over the inline data URL', () => {
    render(
      <AttachmentStrip
        images={[image({ blobUrl: 'blob:cheap', dataUrl: 'data:image/png;base64,HUGE' })]}
      />
    )
    expect(screen.getByTestId('ai-send-attachment-preview')).toHaveAttribute('src', 'blob:cheap')
  })

  // Large captures get their blob URL synthesized asynchronously, so the
  // inline data URL is the only source available for the first frames.
  it('falls back to the inline data URL while the blob is pending', () => {
    render(<AttachmentStrip images={[image({ dataUrl: 'data:image/png;base64,OK' })]} />)
    expect(screen.getByTestId('ai-send-attachment-preview')).toHaveAttribute(
      'src',
      'data:image/png;base64,OK'
    )
  })

  it('shows a placeholder instead of a broken image when no source exists', () => {
    render(<AttachmentStrip images={[image()]} />)
    expect(screen.queryByTestId('ai-send-attachment-preview')).not.toBeInTheDocument()
    expect(screen.getByTestId('ai-send-attachment-pending')).toBeInTheDocument()
  })

  it('labels each thumbnail with its position', () => {
    render(
      <AttachmentStrip
        images={[
          image({ id: 'a', dataUrl: 'data:image/png;base64,A' }),
          image({ id: 'b', dataUrl: 'data:image/png;base64,B' }),
          image({ id: 'c', dataUrl: 'data:image/png;base64,C' })
        ]}
      />
    )
    expect(screen.getByAltText('Image 1')).toBeInTheDocument()
    expect(screen.getByAltText('Image 2')).toBeInTheDocument()
    expect(screen.getByAltText('Image 3')).toBeInTheDocument()
  })

  it('exposes the strip as a labelled list', () => {
    render(<AttachmentStrip images={[image()]} />)
    expect(screen.getByRole('list', { name: /selected images/i })).toBeInTheDocument()
  })
})
