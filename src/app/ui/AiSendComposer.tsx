import { useAppearance } from '@app/providers'
import { useLocalStorage } from '@shared/hooks'
import { hexToRgba } from '@shared/lib/uiUtils'

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Variants } from 'motion/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import AiSendComposerContent from './aiSendComposer/AiSendComposerContent'
import AiSendComposerHeader from './aiSendComposer/AiSendComposerHeader'
import type { AiSendComposerProps, SendFeedback } from './aiSendComposer/types'
import { useAiSendComposerLayout } from './aiSendComposer/useAiSendComposerLayout'
import { useAiSendComposerState } from './aiSendComposer/useAiSendComposerState'

const EXPANDED_PREF_KEY = 'aiSendComposerExpanded'

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

  const prevItemsLengthRef = useRef(items.length)

  const { noteText, setNoteText, isSubmitting, setIsSubmitting, clearNote } =
    useAiSendComposerState()

  const mountedRef = useRef(true)

  // Refs so handleSend does not depend on `noteText` or `effectiveAutoSend`,
  // which change on every keystroke / expand toggle. Without these refs,
  // handleSend defeats ComposerFooter's memo every time the user types.
  const noteTextRef = useRef(noteText)
  noteTextRef.current = noteText
  const effectiveAutoSendRef = useRef(effectiveAutoSend)
  effectiveAutoSendRef.current = effectiveAutoSend

  // Also ref for items.length in handleClearAll: avoids recreating the
  // callback on every item add/remove, which would defeat AiSendComposerHeader's memo.
  const itemsLengthRef = useRef(items.length)
  itemsLengthRef.current = items.length
  const onClearAllRef = useRef(onClearAll)
  onClearAllRef.current = onClearAll
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

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

  const accentStrong = useMemo(() => hexToRgba(selectionColor, 0.9), [selectionColor])

  const panelVariants: Variants = useMemo(
    () =>
      prefersReducedMotion
        ? {
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.08 } },
            exit: { opacity: 0, transition: { duration: 0.06 } }
          }
        : {
            hidden: { opacity: 0, scale: 0.94, y: 8 },
            visible: {
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { type: 'spring', stiffness: 500, damping: 28, mass: 0.5 }
            },
            exit: {
              opacity: 0,
              scale: 0.94,
              y: 8,
              transition: { duration: 0.1, ease: [0.32, 0, 0.67, 0] }
            }
          },
    [prefersReducedMotion]
  )

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

        if (!mountedRef.current) return

        const wasSuccessful =
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true

        if (wasSuccessful) {
          setSendFeedback('success')
          feedbackTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setSendFeedback('idle')
          }, 1500)
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
        if (!mountedRef.current) return
        setSendFeedback('error')
        setLastError('unknown_error')
        setIsExpanded(true)
        setStoredExpanded(true)
      } finally {
        if (mountedRef.current) setIsSubmitting(false)
      }
    },
    [onSend, isSubmitting, setStoredExpanded]
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

  useEffect(() => {
    if (typeof document === 'undefined') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault()
        handleToggleExpand()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, handleToggleExpand])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isSubmitting || items.length === 0) return

    const handleClickOutside = (event: MouseEvent) => {
      const el = asideRef.current
      if (!el) return
      const panel = el.querySelector('[data-panel]')
      if (panel && panel.contains(event.target as Node)) return
      if (el.contains(event.target as Node)) return
      const target = event.target as Node
      if (target instanceof Element) {
        if (
          target.closest('[role="dialog"], [role="tooltip"], [role="alertdialog"]') ||
          target.closest('[data-sonner-toaster]')
        )
          return
      }
      clearNote()
      onClearAll()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSubmitting, items.length, clearNote, onClearAll])

  useEffect(() => {
    if (items.length > prevItemsLengthRef.current && items.length > 0) {
      setSendFeedback('idle')
      setLastError(null)
    }
    prevItemsLengthRef.current = items.length
  }, [items.length])

  const handleForceSend = useCallback(() => {
    void handleSend({ forceAutoSend: true })
  }, [handleSend])

  if (typeof document === 'undefined') return null

  const showContent = isExpanded && sendFeedback !== 'sending'
  const totalItems = textCount + imageCount

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

          <AnimatePresence>
            {sendFeedback === 'success' ? (
              <motion.div
                key="success-badge"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.08 }}
                className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-4 py-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
                <span className="text-ql-11 font-semibold text-emerald-400/90">
                  {t('ai_send_sent')}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {sendFeedback === 'error' && !isExpanded ? (
              <motion.div
                key="error-badge"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.08 }}
                className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-4 py-2"
              >
                <AlertCircle className="h-3.5 w-3.5 text-red-400" strokeWidth={2} />
                <span className="text-ql-11 font-semibold text-red-400/90">
                  {t('ai_send_error')}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.aside>
    </AnimatePresence>,
    document.body
  )
}

export default memo(AiSendComposer)
