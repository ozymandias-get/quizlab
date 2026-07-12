import { useAppearance } from '@app/providers'
import { useLocalStorage } from '@shared/hooks'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type CSSProperties, memo, useCallback, useMemo, useRef, useState } from 'react'
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
import type { AiSendComposerProps, SendFeedback } from './aiSendComposer/types'
import {
  useAiSendComposerClickOutside,
  useAiSendComposerFeedbackReset,
  useAiSendComposerKeyboard
} from './aiSendComposer/useAiSendComposerEffects'
import { useAiSendComposerLayout } from './aiSendComposer/useAiSendComposerLayout'
import { useAiSendComposerState } from './aiSendComposer/useAiSendComposerState'
function AiSendComposer({ items, onClearAll, onSend }: AiSendComposerProps) {
  const selectionColor = useAppearance((s) => s.selectionColor)
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const prefersReducedMotion = useReducedMotion()
  const [isStoredExpanded, setStoredExpanded] = useLocalStorage<boolean>(EXPANDED_PREF_KEY, true)
  const [isExpanded, setIsExpanded] = useState(isStoredExpanded)
  const effectiveAutoSend = !isExpanded
  const [sendFeedback, setSendFeedback] = useState<SendFeedback>('idle')
  const [lastError, setLastError] = useState<string | null>(null)

  const { noteText, setNoteText, isSubmitting, setIsSubmitting, clearNote } =
    useAiSendComposerState()

  const noteTextRef = useRef(noteText)
  noteTextRef.current = noteText
  const effectiveAutoSendRef = useRef(effectiveAutoSend)
  effectiveAutoSendRef.current = effectiveAutoSend
  const itemsLengthRef = useRef(items.length)
  itemsLengthRef.current = items.length
  const onClearAllRef = useRef(onClearAll)
  onClearAllRef.current = onClearAll

  const {
    layout,
    panelRef,
    asideRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    getResizeCursor,
    resizeHandlers,
    edgeThickness
  } = useAiSendComposerLayout(isExpanded)
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
  const handleSend = useCallback(
    async (options?: { forceAutoSend?: boolean }) => {
      if (isSubmitting) return
      setIsSubmitting(true)
      setSendFeedback('sending')
      setLastError(null)
      setIsExpanded(false)
      setStoredExpanded(false)
      try {
        const result = await onSend({
          noteText: noteTextRef.current.trim() || undefined,
          autoSend: effectiveAutoSendRef.current,
          ...options
        })
        const wasSuccessful =
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true

        if (wasSuccessful) {
          setSendFeedback('success')
          setTimeout(() => setSendFeedback('idle'), 1500)
        } else {
          setSendFeedback('error')
          const rawError =
            typeof result === 'object' && result && 'error' in result
              ? String((result as { error?: string }).error)
              : null
          const errorKey = rawError ? `error_${rawError}` : 'unknown_error'
          const localizedError = t(errorKey)
          setLastError(localizedError === errorKey ? rawError : localizedError)
          setIsExpanded(true)
          setStoredExpanded(true)
        }
      } catch {
        setSendFeedback('error')
        setLastError('unknown_error')
        setIsExpanded(true)
        setStoredExpanded(true)
      } finally {
        setIsSubmitting(false)
      }
    },
    [onSend, isSubmitting, setIsSubmitting, setStoredExpanded, t]
  )

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev
      setStoredExpanded(next)
      return next
    })
  }, [setStoredExpanded])
  const handleRetry = useCallback(() => {
    setSendFeedback('idle')
    setLastError(null)
  }, [])
  const handleClearAll = useCallback(() => {
    if (itemsLengthRef.current > 1) {
      if (!confirm(t('ai_send_clear_confirm'))) return
    }
    clearNote()
    onClearAllRef.current()
  }, [clearNote, t])
  useAiSendComposerKeyboard(isSubmitting, handleToggleExpand)
  useAiSendComposerClickOutside(isSubmitting, items.length, asideRef, clearNote, onClearAll)
  useAiSendComposerFeedbackReset(items.length, setSendFeedback, setLastError)
  const handleForceSend = useCallback(() => {
    void handleSend({ forceAutoSend: true })
  }, [handleSend])

  const portalStyle = useMemo(
    () => ({
      left: layout.x,
      top: layout.y,
      width: layout.width,
      height: layout.height
    }),
    [layout.x, layout.y, layout.width, layout.height]
  )

  const panelStyle: CSSProperties = useMemo(
    () => ({
      boxShadow: '0 25px 50px oklch(0 0 0 / 0.95)',
      border: '1px solid oklch(0 0 0 / 0.8)',
      background: 'oklch(0 0 0)',
      backdropFilter: 'none'
    }),
    []
  )
  if (typeof document === 'undefined') return null
  const showContent = isExpanded && sendFeedback !== 'sending'
  const totalItems = textCount + imageCount

  return createPortal(
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
        className="z-modal fixed"
        style={portalStyle}
        role="dialog"
        aria-label={t('ai_send_panel_title')}
      >
        <div
          ref={panelRef}
          data-panel
          className="relative h-full overflow-hidden rounded-2xl text-white"
          style={panelStyle}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

          <AiSendComposerHeader
            textCount={textCount}
            imageCount={imageCount}
            autoSend={effectiveAutoSend}
            isExpanded={isExpanded}
            sendFeedback={sendFeedback}
            onToggleExpand={handleToggleExpand}
            onClearAll={handleClearAll}
            onSend={handleForceSend}
            isSubmitting={isSubmitting}
            isSendDisabled={totalItems === 0}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />

          <AnimatePresence initial={false} mode="wait">
            {showContent ? (
              <motion.div
                key="expanded-content"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.08 }
                    : { duration: 0.1, ease: [0.32, 0, 0.67, 0] }
                }
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
    </AnimatePresence>,
    document.body
  )
}
export default memo(AiSendComposer)
