import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { useAppearance } from '@app/providers'
import { useConfirmDialog, useLocalStorage } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import AiSendComposerContent from './aiSendComposer/AiSendComposerContent'
import AiSendComposerHeader from './aiSendComposer/AiSendComposerHeader'
import { ErrorBadge, SuccessBadge } from './aiSendComposer/composerBadges'
import {
  EXPANDED_PREF_KEY,
  useAccentStrong,
  usePanelVariants
} from './aiSendComposer/composerConstants'
import type { AiSendComposerProps } from './aiSendComposer/types'
import {
  useAiSendComposerClickOutside,
  useAiSendComposerFeedbackReset,
  useAiSendComposerKeyboard
} from './aiSendComposer/useAiSendComposerEffects'
import { useAiSendComposerLayout } from './aiSendComposer/useAiSendComposerLayout'
import { useAiSendComposerState } from './aiSendComposer/useAiSendComposerState'
import { useAiSendComposerStyles } from './aiSendComposer/useAiSendComposerStyles'
import { useComposerSendAction } from './aiSendComposer/useComposerSendAction'

function AiSendComposer({ items, onClearAll, onSend }: AiSendComposerProps) {
  const selectionColor = useAppearance((s) => s.selectionColor)
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const prefersReducedMotion = useReducedMotion()
  const [isStoredExpanded, setStoredExpanded] = useLocalStorage<boolean>(EXPANDED_PREF_KEY, true)
  const [isExpanded, setIsExpanded] = useState(isStoredExpanded)
  const effectiveAutoSend = !isExpanded

  const { noteText, setNoteText, isSubmitting, setIsSubmitting, clearNote } =
    useAiSendComposerState()

  const itemsLengthRef = useRef(items.length)
  itemsLengthRef.current = items.length
  const onClearAllRef = useRef(onClearAll)
  onClearAllRef.current = onClearAll

  const latestPosition = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (item.type === 'text' && item.position) {
        return item.position
      }
    }
    return null
  }, [items])

  const {
    layout,
    panelRef,
    asideRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragLostCapture,
    handleResizeStart,
    handleResizeKeyDown,
    getResizeCursor,
    resizeHandlers,
    edgeThickness
  } = useAiSendComposerLayout(isExpanded, latestPosition)

  const { textCount, imageCount } = useMemo(() => {
    let text = 0
    let image = 0
    for (const draft of items) {
      if (draft.type === 'text') text += 1
      else image += 1
    }
    return { textCount: text, imageCount: image }
  }, [items])

  const accentStrong = useAccentStrong(selectionColor)
  const panelVariants = usePanelVariants(prefersReducedMotion ?? undefined)

  const {
    sendFeedback,
    setSendFeedback,
    lastError,
    setLastError,
    handleSend,
    handleRetry,
    handleForceSend,
    handleSendWithPreset
  } = useComposerSendAction({
    isSubmitting,
    setIsSubmitting,
    onSend,
    noteText,
    effectiveAutoSend,
    setIsExpanded,
    setStoredExpanded
  })

  const { confirm, props: confirmProps } = useConfirmDialog()

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev
      setStoredExpanded(next)
      return next
    })
  }, [setStoredExpanded])

  const handleClearAll = useCallback(async () => {
    if (itemsLengthRef.current > 1) {
      if (!(await confirm({ title: t('ai_send_clear_confirm'), variant: 'destructive' }))) return
    }
    clearNote()
    onClearAllRef.current()
  }, [clearNote, t, confirm])

  useAiSendComposerKeyboard(isSubmitting, handleToggleExpand)
  // Route outside-clicks through the same guarded clear as the UI button so
  // an accidental click (e.g. starting a PDF text selection) cannot silently
  // wipe a multi-item draft queue.
  useAiSendComposerClickOutside(isSubmitting, items.length, asideRef, clearNote, handleClearAll)
  useAiSendComposerFeedbackReset(items.length, isSubmitting, setSendFeedback, setLastError)

  const { portalStyle, panelStyle } = useAiSendComposerStyles(isExpanded, layout)

  if (typeof document === 'undefined') return null
  const showContent = isExpanded && sendFeedback !== 'sending'
  const totalItems = textCount + imageCount

  return createPortal(
    <>
      <AnimatePresence initial={false}>
        <motion.aside
          key="ai-send-composer"
          data-app-locale={language}
          data-tour-id="tour-target-ai-send-composer"
          ref={asideRef}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={panelVariants}
          className="z-modal motion-slow fixed transition-[width,height,left,top] ease-out"
          style={portalStyle}
          role="dialog"
          aria-label={t('ai_send_panel_title')}
        >
          <div
            ref={panelRef}
            data-panel
            className={cn(
              'motion-slow relative transition-[border-radius,background-color] ease-out',
              isExpanded
                ? 'bg-card text-foreground h-full overflow-hidden rounded-2xl'
                : 'bg-card/95 h-11 w-max overflow-visible rounded-full text-white'
            )}
            style={panelStyle}
          >
            <AiSendComposerHeader
              textCount={textCount}
              imageCount={imageCount}
              autoSend={effectiveAutoSend}
              isExpanded={isExpanded}
              sendFeedback={sendFeedback}
              onToggleExpand={handleToggleExpand}
              onClearAll={handleClearAll}
              onSend={handleForceSend}
              onSendWithPreset={handleSendWithPreset}
              isSubmitting={isSubmitting}
              isSendDisabled={totalItems === 0}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragLostCapture={handleDragLostCapture}
            />

            <AnimatePresence initial={false}>
              {showContent ? (
                <motion.div
                  key="expanded-content"
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
                  transition={{ duration: DURATION.normal, ease: 'easeOut' }}
                  className="h-full"
                >
                  <AiSendComposerContent
                    items={items}
                    totalItems={totalItems}
                    noteText={noteText}
                    isSubmitting={isSubmitting}
                    sendFeedback={sendFeedback}
                    lastError={lastError}
                    accentStrong={accentStrong}
                    onNoteTextChange={setNoteText}
                    onSubmit={handleSend}
                    onRetry={handleRetry}
                    onResizeStart={handleResizeStart}
                    onResizeKeyDown={handleResizeKeyDown}
                    getResizeCursor={getResizeCursor}
                    resizeHandlers={resizeHandlers}
                    edgeThickness={edgeThickness}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {sendFeedback === 'success' ? <SuccessBadge /> : null}
            {sendFeedback === 'error' && !isExpanded ? <ErrorBadge /> : null}
          </div>
        </motion.aside>
      </AnimatePresence>
      <ConfirmDialog {...confirmProps} />
    </>,
    document.body
  )
}
export default memo(AiSendComposer)
