import { memo, useCallback, useMemo, useState, type PointerEventHandler } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLanguageStrings } from '@app/providers'
import type { AiDraftItem } from '@app/providers/ai/types'
import QueueTextItem from './QueueTextItem'
import QueueImageItem from './QueueImageItem'
import NoteSection from './NoteSection'
import ComposerFooter from './ComposerFooter'
import SendModeBar from './SendModeBar'
import { useNoteKeyboardHandler, useQueueItemOrdinals } from './useNoteKeyboardHandler'

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
  onResizeStart: PointerEventHandler<HTMLButtonElement>
  onResizeMove: PointerEventHandler<HTMLButtonElement>
  onResizeEnd: PointerEventHandler<HTMLButtonElement>
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
  onResizeMove,
  onResizeEnd
}: AiSendComposerContentProps) {
  const { t } = useLanguageStrings()
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

  return (
    <>
      <SendModeBar autoSend={autoSend} onToggle={onAutoSendChange} />

      <NoteSection
        noteText={noteText}
        hasImages={hasImages}
        onNoteTextChange={onNoteTextChange}
        onKeyDown={handleNoteKeyDown}
      />

      <div
        className="relative space-y-2 overflow-y-auto px-3.5 pb-2"
        style={{
          height: Math.max(100, bodyHeight),
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent'
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
          <div className="rounded-lg border border-red-400/15 bg-red-500/[0.05] px-2.5 py-2">
            <p className="text-[10px] font-medium text-red-300/70">{lastError}</p>
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

      <button
        type="button"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        className="absolute bottom-1 right-1 flex h-5 w-5 cursor-nwse-resize items-end justify-end rounded-full text-white/10 transition-colors duration-150 hover:text-white/25"
        title={t('ai_send_resize')}
        aria-label={t('ai_send_resize')}
      >
        <span className="relative block h-3 w-3">
          <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-br-[0.3rem] border-b-[1.5px] border-r-[1.5px] border-current" />
          <span className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-br-[0.25rem] border-b-[1.5px] border-r-[1.5px] border-current opacity-50" />
        </span>
      </button>
    </>
  )
}

export default memo(AiSendComposerContent)
