import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { useAppearance, useLanguage } from '@app/providers'
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
  const { selectionColor } = useAppearance()
  const { t } = useLanguage()
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
    async (options?: { autoSend?: boolean }) => {
      if (isSubmitting || items.length === 0) {
        return
      }

      let dismissTimer: ReturnType<typeof setTimeout> | null = null

      try {
        setIsSubmitting(true)
        setIsClosingAfterSubmit(true)
        dismissTimer = setTimeout(() => {
          setIsDismissed(true)
        }, DISMISS_AFTER_SUBMIT_MS)

        const result = await onSend({
          noteText: noteText.trim() || undefined,
          autoSend: options?.autoSend
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
  const accentGlow = hexToRgba(selectionColor, 0.15)
  const panelShellBackground = `
        linear-gradient(180deg, rgba(10,14,22,0.86) 0%, rgba(7,10,15,0.93) 52%, rgba(5,7,11,0.975) 100%),
        radial-gradient(ellipse at top, ${accentGlow}, transparent 55%),
        radial-gradient(circle at 85% 100%, rgba(200,80,180,0.06), transparent 30%)
    `
  const panelGlowBackground = `
        radial-gradient(ellipse at top left, rgba(255,255,255,0.08), transparent 45%),
        radial-gradient(circle at 80% 15%, rgba(255,255,255,0.03), transparent 25%),
        linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))
    `
  const sectionSurface = `
        linear-gradient(180deg, rgba(18,23,33,0.72), rgba(12,16,24,0.86))
    `
  const cardSurface = `
        linear-gradient(180deg, rgba(24,30,43,0.78), rgba(15,20,30,0.9))
    `
  const footerSurface = `
        linear-gradient(180deg, rgba(9,12,18,0.82), rgba(7,10,15,0.94) 30%, rgba(4,6,10,0.985))
    `
  const panelVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 28,
      scale: 0.94,
      filter: 'blur(12px)'
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        type: 'spring' as const,
        stiffness: 260,
        damping: 24,
        mass: 0.9,
        staggerChildren: 0.06,
        delayChildren: 0.04
      }
    },
    exit: {
      opacity: 0,
      y: 18,
      scale: 0.96,
      filter: 'blur(8px)',
      transition: {
        duration: 0.18,
        ease: 'easeInOut'
      }
    }
  }
  const sectionVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 10
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.28,
        ease: 'easeOut'
      }
    }
  }

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
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={panelVariants}
          className="fixed z-[110]"
          style={{
            left: layout.x,
            top: layout.y,
            width: layout.width
          }}
        >
          <div
            ref={panelRef}
            className="relative isolate overflow-hidden rounded-[2rem] text-white shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            style={{
              background: panelShellBackground,
              boxShadow: `
                                0 24px 64px -12px rgba(0,0,0,0.6),
                                0 0 0 1px rgba(255,255,255,0.04),
                                inset 0 1px 0 rgba(255,255,255,0.05)
                            `
            }}
          >
            <AnimatePresence>
              {isClosingAfterSubmit ? (
                <motion.div
                  key="sending-overlay"
                  initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                  animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                  exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/20"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                    className="rounded-full border border-amber-300/20 bg-amber-400/12 px-5 py-2.5 text-sm font-semibold text-amber-100 shadow-[0_10px_30px_-12px_rgba(251,191,36,0.55)]"
                  >
                    {t('sending_to_ai')}
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: sectionSurface, opacity: 0.72 }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: panelGlowBackground }}
            />
            <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] border border-white/[0.08]" />
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)] opacity-60" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.12)_40%,rgba(0,0,0,0.3))]" />

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
                  void handleSubmit({ autoSend: true })
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
                exit={{
                  opacity: 0,
                  y: 8,
                  transition: { duration: 0.16, ease: 'easeInOut' }
                }}
              >
                <AiSendComposerContent
                  textItems={textItems}
                  imageItems={imageItems}
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
