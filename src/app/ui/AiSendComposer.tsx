import { memo, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useAppearance, useLanguageStrings } from '@app/providers'
import { hexToRgba } from '@shared/lib/uiUtils'
import { useLocalStorage } from '@shared/hooks'
import AiSendComposerContent from './aiSendComposer/AiSendComposerContent'
import AiSendComposerHeader from './aiSendComposer/AiSendComposerHeader'
import type { AiSendComposerProps, SendFeedback } from './aiSendComposer/types'
import { useAiSendComposerLayout } from './aiSendComposer/useAiSendComposerLayout'
import { useAiSendComposerState } from './aiSendComposer/useAiSendComposerState'

const EXPANDED_PREF_KEY = 'aiSendComposerExpanded'

function AiSendComposer({
  items,
  autoSend,
  onAutoSendChange,
  onRemoveItem,
  onClearAll,
  onSend
}: AiSendComposerProps) {
  const selectionColor = useAppearance((s) => s.selectionColor)
  const { t, language } = useLanguageStrings()
  const prefersReducedMotion = useReducedMotion()

  const [storedExpanded, setStoredExpanded] = useLocalStorage<boolean>(EXPANDED_PREF_KEY, true)
  const [isExpanded, setIsExpanded] = useState(storedExpanded)
  const [sendFeedback, setSendFeedback] = useState<SendFeedback>('idle')
  const [lastError, setLastError] = useState<string | null>(null)

  const prevItemsLengthRef = useRef(items.length)

  const { noteText, setNoteText, isSubmitting, isDismissed, clearNote } = useAiSendComposerState({
    items,
    onSend
  })

  const {
    layout,
    bodyHeight,
    panelRef,
    asideRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  } = useAiSendComposerLayout(items.length, isExpanded)

  const textCount = useMemo(
    () => items.reduce((n, item) => n + (item.type === 'text' ? 1 : 0), 0),
    [items]
  )
  const imageCount = useMemo(
    () => items.reduce((n, item) => n + (item.type === 'image' ? 1 : 0), 0),
    [items]
  )

  const accentStrong = useMemo(() => hexToRgba(selectionColor, 0.9), [selectionColor])

  const panelVariants: Variants = useMemo(
    () =>
      prefersReducedMotion
        ? {
            hidden: { opacity: 0, y: 6 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
            exit: { opacity: 0, y: 4, transition: { duration: 0.12, ease: 'easeIn' } }
          }
        : {
            hidden: { opacity: 0, y: 12, scale: 0.97 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                type: 'spring' as const,
                stiffness: 340,
                damping: 30,
                mass: 0.7
              }
            },
            exit: {
              opacity: 0,
              y: 8,
              scale: 0.98,
              transition: { duration: 0.18, ease: [0.32, 0, 0.67, 0] }
            }
          },
    [prefersReducedMotion]
  )

  const handleSend = useCallback(
    async (options?: { forceAutoSend?: boolean }) => {
      if (isSubmitting) return

      setSendFeedback('sending')
      setLastError(null)

      setIsExpanded(false)
      setStoredExpanded(false)

      try {
        const result = await onSend({
          noteText: noteText.trim() || undefined,
          ...options
        })
        const wasSuccessful =
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true

        if (wasSuccessful) {
          setSendFeedback('success')
          setTimeout(() => {
            setSendFeedback('idle')
          }, 1500)
        } else {
          setSendFeedback('error')
          setLastError(
            typeof result === 'object' && result && 'error' in result
              ? String((result as { error?: string }).error)
              : null
          )
          setIsExpanded(true)
          setStoredExpanded(true)
        }
      } catch {
        setSendFeedback('error')
        setLastError('unknown_error')
        setIsExpanded(true)
        setStoredExpanded(true)
      }
    },
    [noteText, onSend, isSubmitting, setStoredExpanded]
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
    if (items.length > 1) {
      if (!confirm(t('ai_send_clear_confirm'))) return
    }
    clearNote()
    onClearAll()
  }, [items.length, clearNote, onClearAll, t])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDismissed && !isSubmitting) {
        event.preventDefault()
        handleToggleExpand()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDismissed, isSubmitting, handleToggleExpand])

  useEffect(() => {
    if (items.length > prevItemsLengthRef.current && items.length > 0) {
      setSendFeedback('idle')
      setLastError(null)
    }
    prevItemsLengthRef.current = items.length
  }, [items.length])

  if (typeof document === 'undefined') return null

  const showContent = isExpanded && sendFeedback !== 'sending'

  return createPortal(
    <AnimatePresence initial={false}>
      {!isDismissed ? (
        <motion.aside
          key="ai-send-composer"
          data-app-locale={language}
          ref={asideRef}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={panelVariants}
          className="fixed z-[110]"
          style={{ left: layout.x, top: layout.y, width: layout.width }}
          role="dialog"
          aria-label={t('ai_send_panel_title')}
        >
          <div
            ref={panelRef}
            className="relative isolate overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#0e1118] text-white shadow-lg"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

            <AiSendComposerHeader
              textCount={textCount}
              imageCount={imageCount}
              autoSend={autoSend}
              isExpanded={isExpanded}
              sendFeedback={sendFeedback}
              onToggleAutoSend={() => onAutoSendChange(!autoSend)}
              onToggleExpand={handleToggleExpand}
              onClearAll={handleClearAll}
              onSend={() => {
                void handleSend({ forceAutoSend: true })
              }}
              isSubmitting={isSubmitting}
              isSendDisabled={items.length === 0}
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
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.12 }
                      : { duration: 0.15, ease: [0.32, 0, 0.67, 0] }
                  }
                >
                  <AiSendComposerContent
                    items={items}
                    totalItems={items.length}
                    noteText={noteText}
                    isSubmitting={isSubmitting}
                    sendFeedback={sendFeedback}
                    lastError={lastError}
                    accentStrong={accentStrong}
                    bodyHeight={bodyHeight}
                    autoSend={autoSend}
                    onAutoSendChange={() => onAutoSendChange(!autoSend)}
                    onRemoveItem={onRemoveItem}
                    onNoteTextChange={setNoteText}
                    onSubmit={(options) => {
                      void handleSend(options)
                    }}
                    onRetry={handleRetry}
                    onResizeStart={handleResizeStart}
                    onResizeMove={handleResizeMove}
                    onResizeEnd={handleResizeEnd}
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
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center gap-1.5 border-t border-white/[0.06] px-3 py-1.5"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-400/80" strokeWidth={2} />
                  <span className="text-[10px] font-medium text-emerald-300/80">
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
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center gap-1.5 border-t border-white/[0.06] px-3 py-1.5"
                >
                  <AlertCircle className="h-3 w-3 text-red-400/80" strokeWidth={2} />
                  <span className="text-[10px] font-medium text-red-300/80">
                    {t('ai_send_error')}
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

export default memo(AiSendComposer)
