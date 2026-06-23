import type { AiDraftItem } from '@app/providers/ai/types'

import { memo, type MouseEventHandler, type PointerEventHandler, useCallback, useMemo } from 'react'

import ComposerFooter from './ComposerFooter'
import NoteSection from './NoteSection'
import type { ResizeDirection } from './types'
import { useNoteKeyboardHandler } from './useNoteKeyboardHandler'

interface ResizeHandlers {
  onResizeMove: (event: React.PointerEvent) => void
  onResizeEnd: (event: React.PointerEvent) => void
}

interface AiSendComposerContentProps {
  items: AiDraftItem[]
  totalItems: number
  noteText: string
  isSubmitting: boolean
  sendFeedback: 'idle' | 'sending' | 'success' | 'error'
  lastError: string | null
  accentStrong: string
  onNoteTextChange: (text: string) => void
  onSubmit: (options?: { autoSend?: boolean; forceAutoSend?: boolean }) => void
  onRetry: () => void
  onResizeStart: (direction: ResizeDirection) => PointerEventHandler<HTMLDivElement>
  getResizeCursor: (dir: ResizeDirection) => string
  resizeHandlers: ResizeHandlers
  edgeThickness: number
}

function AiSendComposerContent({
  items,
  totalItems,
  noteText,
  isSubmitting,
  sendFeedback,
  lastError,
  accentStrong,
  onNoteTextChange,
  onSubmit,
  onRetry,
  onResizeStart,
  getResizeCursor,
  resizeHandlers,
  edgeThickness
}: AiSendComposerContentProps) {
  const hasImages = useMemo(() => items.some((i) => i.type === 'image'), [items])

  const handleNoteKeyDown = useNoteKeyboardHandler({
    hasNoteText: noteText.trim().length > 0,
    isSubmitting,
    totalItems,
    onNoteTextChange,
    onSubmit
  })

  const handleResizeMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>((event) => {
    event.stopPropagation()
  }, [])

  const resizeEdges = useMemo(() => {
    const dirs: { dir: ResizeDirection; position: React.CSSProperties; cursor: string }[] = [
      {
        dir: 'n',
        position: { top: 0, left: edgeThickness, right: edgeThickness, height: edgeThickness },
        cursor: getResizeCursor('n')
      },
      {
        dir: 's',
        position: { bottom: 0, left: edgeThickness, right: edgeThickness, height: edgeThickness },
        cursor: getResizeCursor('s')
      },
      {
        dir: 'e',
        position: { top: edgeThickness, right: 0, bottom: edgeThickness, width: edgeThickness },
        cursor: getResizeCursor('e')
      },
      {
        dir: 'w',
        position: { top: edgeThickness, left: 0, bottom: edgeThickness, width: edgeThickness },
        cursor: getResizeCursor('w')
      },
      {
        dir: 'ne',
        position: { top: 0, right: 0, width: edgeThickness * 2, height: edgeThickness * 2 },
        cursor: getResizeCursor('ne')
      },
      {
        dir: 'nw',
        position: { top: 0, left: 0, width: edgeThickness * 2, height: edgeThickness * 2 },
        cursor: getResizeCursor('nw')
      },
      {
        dir: 'se',
        position: { bottom: 0, right: 0, width: edgeThickness * 2, height: edgeThickness * 2 },
        cursor: getResizeCursor('se')
      },
      {
        dir: 'sw',
        position: { bottom: 0, left: 0, width: edgeThickness * 2, height: edgeThickness * 2 },
        cursor: getResizeCursor('sw')
      }
    ]
    return dirs
  }, [edgeThickness, getResizeCursor])

  return (
    <>
      {/* Resize edges */}
      {resizeEdges.map(({ dir, position, cursor }) => (
        <div
          key={dir}
          data-resize
          role="button"
          tabIndex={0}
          onPointerDown={onResizeStart(dir)}
          onPointerMove={resizeHandlers.onResizeMove}
          onPointerUp={resizeHandlers.onResizeEnd}
          onPointerCancel={resizeHandlers.onResizeEnd}
          onMouseDown={handleResizeMouseDown}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
            }
          }}
          className="absolute z-20"
          style={{ ...position, cursor }}
        />
      ))}

      <NoteSection
        noteText={noteText}
        hasImages={hasImages}
        onNoteTextChange={onNoteTextChange}
        onKeyDown={handleNoteKeyDown}
      />

      {sendFeedback === 'error' && lastError && (
        <div className="mx-4 mb-2 rounded-xl border border-red-400/20 bg-red-500/[0.08] px-3 py-2.5">
          <p className="text-ql-12 font-medium text-red-300/80">{lastError}</p>
        </div>
      )}

      <ComposerFooter
        isSubmitting={isSubmitting}
        sendFeedback={sendFeedback}
        lastError={lastError}
        totalItems={totalItems}
        accentStrong={accentStrong}
        onSubmit={onSubmit}
        onRetry={onRetry}
      />
    </>
  )
}

export default memo(AiSendComposerContent)
