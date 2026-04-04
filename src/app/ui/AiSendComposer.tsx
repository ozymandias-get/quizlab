import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useAppearance, useLanguageStrings } from '@app/providers'
import type { AiDraftImageItem, AiDraftTextItem } from '@app/providers/ai/types'
import { hexToRgba } from '@shared/lib/uiUtils'
import AiSendComposerContent from './aiSendComposer/AiSendComposerContent'
import AiSendComposerHeader from './aiSendComposer/AiSendComposerHeader'
import AiSendComposerToggle from './aiSendComposer/AiSendComposerToggle'
import type { AiSendComposerProps } from './aiSendComposer/types'
import { useAiSendComposerLayout } from './aiSendComposer/useAiSendComposerLayout'

const DISMISS_AFTER_SUBMIT_MS = 320

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
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClosingAfterSubmit, setIsClosingAfterSubmit] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const {
    layout,
    isDragging,
    bodyHeight,
    panelRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  } = useAiSendComposerLayout(items.length)

  const textItems = useMemo(
    () => items.filter((item): item is AiDraftTextItem => item.type === 'text'),
    [items]
  )
  const imageItems = useMemo(
    () => items.filter((item): item is AiDraftImageItem => item.type === 'image'),
    [items]
  )
  const resetDismissState = useCallback((dismissTimer: ReturnType<typeof setTimeout> | null) => {
    if (dismissTimer) {
      clearTimeout(dismissTimer)
    }
    setIsClosingAfterSubmit(false)
    setIsDismissed(false)
  }, [])

  const handleSubmit = useCallback(
    async (options?: { autoSend?: boolean; forceAutoSend?: boolean }) => {
      if (isSubmitting || items.length === 0) {
        return
      }

      const forcedAutoSend = options?.forceAutoSend === true || options?.autoSend === true

      let dismissTimer: ReturnType<typeof setTimeout> | null = null

      try {
        setIsSubmitting(true)
        setIsClosingAfterSubmit(true)
        dismissTimer = setTimeout(() => {
          setIsDismissed(true)
        }, DISMISS_AFTER_SUBMIT_MS)

        const result = await onSend({
          noteText: noteText.trim() || undefined,
          ...(forcedAutoSend ? { forceAutoSend: true as const } : {})
        })

        const wasSuccessful =
          typeof result === 'object' && result !== null && 'success' in result
            ? Boolean((result as { success?: boolean }).success)
            : true

        if (wasSuccessful) {
          setNoteText('')
          return
        }

        resetDismissState(dismissTimer)
      } catch {
        resetDismissState(dismissTimer)
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, items.length, noteText, onSend, resetDismissState]
  )

  const accentStrong = hexToRgba(selectionColor, 0.9)
  const accentGlow = hexToRgba(selectionColor, 0.12)

  const panelShellBackground = `
    linear-gradient(180deg, rgba(12,16,24,0.92) 0%, rgba(8,11,17,0.96) 50%, rgba(5,7,12,0.98) 100%),
    radial-gradient(ellipse 70% 40% at 50% 0%, ${accentGlow}, transparent 60%)
  `
  const sectionSurface = `
    linear-gradient(180deg, rgba(18,23,33,0.65), rgba(12,16,24,0.8))
  `
  const cardSurface = `
    linear-gradient(180deg, rgba(22,28,40,0.7), rgba(14,18,28,0.85))
  `
  const footerSurface = `
    linear-gradient(180deg, rgba(10,13,20,0.85), rgba(6,8,13,0.95))
  `

  const panelVariants: Variants = useMemo(
    () =>
      prefersReducedMotion
        ? {
            hidden: { opacity: 0, y: 6 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.18, ease: 'easeOut' }
            },
            exit: {
              opacity: 0,
              y: 4,
              transition: { duration: 0.12, ease: 'easeIn' }
            }
          }
        : {
            hidden: {
              opacity: 0,
              y: 24,
              scale: 0.95,
              filter: 'blur(8px)'
            },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: 'blur(0px)',
              transition: {
                type: 'spring' as const,
                stiffness: 340,
                damping: 30,
                mass: 0.7,
                staggerChildren: 0.04,
                delayChildren: 0.02
              }
            },
            exit: {
              opacity: 0,
              y: 16,
              scale: 0.97,
              filter: 'blur(6px)',
              transition: {
                duration: 0.22,
                ease: [0.32, 0, 0.67, 0]
              }
            }
          },
    [prefersReducedMotion]
  )

  const sectionVariants: Variants = useMemo(
    () =>
      prefersReducedMotion
        ? {
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.15 } }
          }
        : {
            hidden: { opacity: 0, y: 8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                type: 'spring' as const,
                stiffness: 400,
                damping: 32,
                mass: 0.6
              }
            }
          },
    [prefersReducedMotion]
  )

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handlePointerDownOutside = (event: PointerEvent) => {
      const panelElement = panelRef.current
      const target = event.target

      if (!panelElement || !(target instanceof Node)) {
        return
      }

      if (panelElement.contains(target)) {
        return
      }

      setNoteText('')
      onClearAll()
    }

    document.addEventListener('pointerdown', handlePointerDownOutside, true)
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside, true)
  }, [onClearAll, panelRef])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AnimatePresence initial={false}>
      {!isDismissed ? (
        <motion.aside
          key="ai-send-composer"
          data-app-locale={language}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={panelVariants}
          className="fixed z-[110] will-change-transform"
          style={{
            left: layout.x,
            top: layout.y,
            width: layout.width
          }}
        >
          <div
            ref={panelRef}
            className="relative isolate overflow-hidden rounded-2xl text-white shadow-[0_16px_48px_-8px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl"
            style={{ background: panelShellBackground }}
          >
            {/* Sending overlay */}
            <AnimatePresence>
              {isClosingAfterSubmit ? (
                <motion.div
                  key="sending-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-md"
                >
                  <motion.div
                    initial={
                      prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.15 }
                        : { type: 'spring', stiffness: 320, damping: 28, mass: 0.65 }
                    }
                    className="flex flex-col items-center gap-2.5"
                  >
                    <motion.div
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06]"
                      animate={
                        prefersReducedMotion
                          ? {}
                          : {
                              boxShadow: [
                                '0 0 16px -6px rgba(255,255,255,0.15)',
                                '0 0 24px -4px rgba(255,255,255,0.25)',
                                '0 0 16px -6px rgba(255,255,255,0.15)'
                              ]
                            }
                      }
                      transition={{
                        duration: 1.6,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'easeInOut'
                      }}
                    >
                      <Loader2
                        className="h-4.5 w-4.5 text-white/80 animate-spin"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </motion.div>
                    <p className="text-[13px] font-medium text-white/70">{t('sending_to_ai')}</p>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Subtle top edge highlight */}
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
            {/* Inner border */}
            <div className="pointer-events-none absolute inset-[1px] rounded-[calc(1rem-1px)] border border-white/[0.05]" />

            <motion.div variants={sectionVariants}>
              <AiSendComposerHeader
                textCount={textItems.length}
                imageCount={imageItems.length}
                autoSend={autoSend}
                onToggleAutoSend={() => onAutoSendChange(!autoSend)}
                onClearAll={onClearAll}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              />
            </motion.div>

            <motion.div variants={sectionVariants}>
              <AiSendComposerToggle
                autoSend={autoSend}
                isDragging={isDragging}
                onToggle={() => onAutoSendChange(!autoSend)}
                onSubmit={() => {
                  void handleSubmit({ forceAutoSend: true })
                }}
                isSubmitting={isSubmitting}
                isSubmitDisabled={items.length === 0}
                accentStrong={accentStrong}
              />
            </motion.div>

            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={autoSend ? 'collapsed' : 'expanded'}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                transition={
                  prefersReducedMotion
                    ? { duration: 0.15 }
                    : { type: 'spring', stiffness: 320, damping: 30, mass: 0.65 }
                }
                exit={{
                  opacity: 0,
                  y: 8,
                  transition: prefersReducedMotion
                    ? { duration: 0.12 }
                    : { duration: 0.18, ease: [0.32, 0, 0.67, 0] }
                }}
              >
                <AiSendComposerContent
                  items={items}
                  totalItems={items.length}
                  noteText={noteText}
                  isSubmitting={isSubmitting}
                  accentStrong={accentStrong}
                  sectionSurface={sectionSurface}
                  cardSurface={cardSurface}
                  footerSurface={footerSurface}
                  textareaInsetShadow={hexToRgba(selectionColor, 0.04)}
                  onRemoveItem={onRemoveItem}
                  onNoteTextChange={setNoteText}
                  onSubmit={(options) => {
                    void handleSubmit(options)
                  }}
                  onResizeStart={handleResizeStart}
                  onResizeMove={handleResizeMove}
                  onResizeEnd={handleResizeEnd}
                  bodyHeight={bodyHeight}
                  collapsed={autoSend}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

export default memo(AiSendComposer)
