import { memo, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@shared/lib/uiUtils'
import { useLanguageStrings } from '@app/providers'
import { Button } from '@ui/components/button'

interface AiSendComposerToggleProps {
  autoSend: boolean
  isDragging?: boolean
  onToggle: () => void
  onSubmit: () => void
  isSubmitting: boolean
  isSubmitDisabled: boolean
  accentStrong: string
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.6 }

function AiSendComposerToggle({
  autoSend,
  isDragging = false,
  onToggle,
  onSubmit,
  isSubmitting,
  isSubmitDisabled,
  accentStrong
}: AiSendComposerToggleProps) {
  const { t } = useLanguageStrings()
  const shouldAnimateLayout = !isDragging
  const handleToggleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ') {
      if (autoSend) {
        return
      }
      event.preventDefault()
      onToggle()
      return
    }

    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()

    if (autoSend) {
      if (event.shiftKey) {
        onToggle()
        return
      }
      if (!isSubmitting && !isSubmitDisabled) {
        onSubmit()
      }
      return
    }

    if (event.shiftKey) {
      return
    }

    onToggle()
  }

  return (
    <div className="relative border-b border-white/[0.05] px-5 py-3">
      <motion.div
        role="button"
        aria-pressed={autoSend}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleToggleKeyDown}
        whileTap={{ scale: 0.985 }}
        className={cn(
          'group relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left outline-none backdrop-blur-2xl backdrop-saturate-200 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-emerald-500/40 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-2xl before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700 before:ease-in-out',
          autoSend
            ? 'border-emerald-400/30 hover:border-emerald-400/45'
            : 'border-white/[0.12] hover:border-white/[0.2]'
        )}
        style={
          autoSend
            ? {
                background:
                  'linear-gradient(150deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.06) 60%, rgba(255,255,255,0.03) 100%)',
                boxShadow:
                  'inset 0 1px 2px rgba(255,255,255,0.1), inset 0 0 0 0.5px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.3)'
              }
            : {
                background:
                  'linear-gradient(150deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)',
                boxShadow:
                  'inset 0 1px 2px rgba(255,255,255,0.1), inset 0 0 0 0.5px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.25)'
              }
        }
      >
        <motion.div
          layout={shouldAnimateLayout}
          className="relative z-10 flex items-center justify-between gap-3"
        >
          <motion.div layout={shouldAnimateLayout} className="min-w-0 flex-1">
            <motion.div layout={shouldAnimateLayout} className="flex items-center gap-2">
              <span
                className={cn(
                  'text-[13px] font-semibold leading-none tracking-[0.005em] transition-colors duration-300',
                  autoSend ? 'text-emerald-50' : 'text-white/75 group-hover:text-white/90'
                )}
              >
                {t('auto_send')}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={autoSend ? 'on' : 'off'}
                  initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'inline-flex rounded-md px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em]',
                    autoSend
                      ? 'bg-emerald-400/15 text-emerald-300/90'
                      : 'bg-white/[0.05] text-white/35'
                  )}
                >
                  {autoSend ? t('auto_send_state_on') : t('auto_send_state_off')}
                </motion.span>
              </AnimatePresence>
            </motion.div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={autoSend ? 'hint-on' : 'hint-off'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={cn(
                  'mt-1.5 text-[11px] leading-[1.45]',
                  autoSend ? 'text-emerald-200/50' : 'text-white/35'
                )}
              >
                {autoSend ? t('auto_send_hint_on') : t('auto_send_hint_off')}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          <div
            className={cn(
              'relative flex h-[22px] w-[40px] shrink-0 items-center rounded-full border transition-all duration-300',
              autoSend
                ? 'border-emerald-400/25 bg-emerald-500/30'
                : 'border-white/[0.08] bg-white/[0.06]'
            )}
          >
            <motion.span
              className={cn(
                'absolute h-[16px] w-[16px] rounded-full shadow-sm',
                autoSend ? 'bg-emerald-300' : 'bg-white/40'
              )}
              animate={{ x: autoSend ? 19 : 3 }}
              transition={SPRING_SNAPPY}
            />
          </div>
        </motion.div>

        <AnimatePresence initial={false}>
          {autoSend ? (
            <motion.div
              key="submit-cta"
              layout={shouldAnimateLayout}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-2.5">
                <Button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSubmit()
                  }}
                  disabled={isSubmitting || isSubmitDisabled}
                  className="w-full rounded-xl border-0 py-2 text-[12px] font-semibold tracking-[0.01em] text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-35"
                  style={{
                    background: `linear-gradient(135deg, ${accentStrong}, rgba(45,212,191,0.65) 70%, rgba(255,255,255,0.18))`
                  }}
                >
                  {isSubmitting ? t('sending_to_ai') : t('send_to_ai')}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default memo(AiSendComposerToggle)
