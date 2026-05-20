import { memo, useCallback, useMemo, useState, type PointerEventHandler } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { AiDraftItem } from '@app/providers/ai/types'
import type { ResizeDirection } from './types'
import QueueTextItem from './QueueTextItem'
import QueueImageItem from './QueueImageItem'
import NoteSection from './NoteSection'
import ComposerFooter from './ComposerFooter'
import SendModeBar from './SendModeBar'
import { useNoteKeyboardHandler, useQueueItemOrdinals } from './useNoteKeyboardHandler'

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
  bodyHeight: number
  autoSend: boolean
  onAutoSendChange: () => void
  onRemoveItem: (id: string) => void
  onNoteTextChange: (value: string) => void
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
  bodyHeight,
  autoSend,
  onAutoSendChange,
  onRemoveItem,
  onNoteTextChange,
  onSubmit,
  onRetry,
  onResizeStart,
  getResizeCursor,
  resizeHandlers,
  edgeThickness
}: AiSendComposerContentProps) {
  const hasImages = useMemo(() => items.some((i) => i.type === 'image'), [items])
  const itemOrdinals = useQueueItemOrdinals(items)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedItemId((prev) => (prev === id ? null : id))
  }, [])

  const handleNoteKeyDown = useNoteKeyboardHandler({
    hasNoteText: noteText.trim().length > 0,
    isSubmitting,
    totalItems,
    onNoteTextChange,
    onSubmit
  })

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
          onPointerDown={onResizeStart(dir)}
          onPointerMove={resizeHandlers.onResizeMove}
          onPointerUp={resizeHandlers.onResizeEnd}
          onPointerCancel={resizeHandlers.onResizeEnd}
          className="absolute z-20"
          style={{ ...position, cursor }}
        />
      ))}

      <SendModeBar autoSend={autoSend} onToggle={onAutoSendChange} />

      <NoteSection
        noteText={noteText}
        hasImages={hasImages}
        onNoteTextChange={onNoteTextChange}
        onKeyDown={handleNoteKeyDown}
      />

      <div
        className="relative space-y-2.5 overflow-y-auto px-4 pb-2.5"
        style={{
          height: Math.max(80, bodyHeight),
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.12) transparent'
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => {
            const ordData = itemOrdinals.get(item.id)
            if (!ordData) return null

            const isExpanded = expandedItemId === item.id

            if (item.type === 'text') {
              return (
                <QueueTextItem
                  key={item.id}
                  id={item.id}
                  text={item.text}
                  ordinal={ordData.ordinal}
                  accentStrong={accentStrong}
                  isExpanded={isExpanded}
                  onToggleExpand={handleToggleExpand}
                  onRemove={onRemoveItem}
                />
              )
            }

            return (
              <QueueImageItem
                key={item.id}
                item={item}
                imageIndex={ordData.ordinal}
                onRemove={onRemoveItem}
              />
            )
          })}
        </AnimatePresence>

        {sendFeedback === 'error' && lastError && (
          <div className="rounded-xl border border-red-400/20 bg-red-500/[0.08] px-3 py-2.5">
            <p className="text-[11px] font-medium text-red-300/80">{lastError}</p>
          </div>
        )}
      </div>

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
