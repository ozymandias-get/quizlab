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

  const panelShellBackground = `
    radial-gradient(ellipse 100% 50% at 50% 0%, ${hexToRgba(selectionColor, 0.22)}, transparent 70%),
    radial-gradient(ellipse 60% 30% at 80% 100%, rgba(255,255,255,0.03), transparent 60%),
    linear-gradient(170deg, #12161e 0%, #080a10 100%)
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
            className="relative isolate overflow-hidden rounded-[20px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_36px_-10px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-2xl backdrop-saturate-200"
            style={{ background: panelShellBackground }}
          >
            <div
              className="pointer-events-none absolute -right-10 -top-8 h-28 w-28 rounded-full blur-3xl"
              style={{ background: hexToRgba(selectionColor, 0.14) }}
            />
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
                    className="flex flex-col items-center gap-2"
                  >
                    <motion.div
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06]"
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
                        className="h-3.5 w-3.5 text-white/80 animate-spin"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </motion.div>
                    <p className="text-ql-11 font-medium text-white/70">{t('sending_to_ai')}</p>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.18] to-transparent" />
            <div
              className="pointer-events-none absolute inset-[1px] rounded-[calc(1.25rem-1px)] border border-white/[0.07]"
              style={{ boxShadow: `inset 0 0 32px -12px ${hexToRgba(selectionColor, 0.08)}` }}
            />

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
