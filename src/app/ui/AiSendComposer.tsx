import { useAppearance } from '@app/providers'
import { useLocalStorage } from '@shared/hooks'
import { cn } from '@shared/lib/uiUtils'

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
import { COMPACT_HEIGHT } from './aiSendComposer/layoutUtils'
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
  const handleSend = useCallback(
    async (options?: { noteText?: string; autoSend?: boolean; forceAutoSend?: boolean }) => {
      if (isSubmitting) return
      setIsSubmitting(true)
      setSendFeedback('sending')
      setLastError(null)
      setIsExpanded(false)
      setStoredExpanded(false)
      try {
        const result = await onSend({
          noteText:
            options?.noteText !== undefined
              ? options.noteText
              : noteTextRef.current.trim() || undefined,
          autoSend:
            options?.autoSend !== undefined ? options.autoSend : effectiveAutoSendRef.current,
          forceAutoSend: options?.forceAutoSend
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
  useAiSendComposerFeedbackReset(items.length, isSubmitting, setSendFeedback, setLastError)
  const handleForceSend = useCallback(() => {
    void handleSend({ forceAutoSend: true })
  }, [handleSend])

  const handleSendWithPreset = useCallback(
    (presetValue: string) => {
      void handleSend({ noteText: presetValue, forceAutoSend: true })
    },
    [handleSend]
  )

  const portalStyle = useMemo(
    () =>
      isExpanded
        ? {
            left: layout.x,
            top: layout.y,
            width: layout.width,
            height: layout.height
          }
        : {
            left: layout.x,
            top: layout.y,
            width: 'max-content',
            height: COMPACT_HEIGHT
          },
    [layout.x, layout.y, layout.width, layout.height, isExpanded]
  )

  const panelStyle: CSSProperties = useMemo(
    () =>
      isExpanded
        ? {
            boxShadow: 'var(--shadow-ambient-2xl, 0 16px 40px -4px rgba(0, 0, 0, 0.45))',
            border: '1px solid oklch(var(--border) / 0.8)',
            background: 'oklch(var(--card) / 0.95)',
            backdropFilter: 'blur(16px)'
          }
        : {
            boxShadow: '0 16px 40px -6px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: '#0f1013',
            backdropFilter: 'blur(24px)'
          },
    [isExpanded]
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
        className="z-modal fixed transition-[width,height,left,top] duration-200 ease-out"
        style={portalStyle}
        role="dialog"
        aria-label={t('ai_send_panel_title')}
      >
        <div
          ref={panelRef}
          data-panel
          className={cn(
            'relative transition-[border-radius,background-color] duration-200 ease-out',
            isExpanded
              ? 'bg-card text-foreground h-full overflow-hidden rounded-2xl'
              : 'h-11 w-max overflow-visible rounded-full bg-[#0f1013] text-white'
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
                transition={{ duration: 0.15, ease: 'easeOut' }}
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
    </AnimatePresence>,
    document.body
  )
}
export default memo(AiSendComposer)
