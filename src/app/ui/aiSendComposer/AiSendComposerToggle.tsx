import type { KeyboardEvent } from 'react'
import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@shared/lib/uiUtils'
import { useLanguage } from '@app/providers'
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

function AiSendComposerToggle({
  autoSend,
  isDragging = false,
  onToggle,
  onSubmit,
  isSubmitting,
  isSubmitDisabled,
  accentStrong
}: AiSendComposerToggleProps) {
  const { t } = useLanguage()
  const shouldAnimateLayout = !isDragging
  const handleToggleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onToggle()
  }

  return (
    <div className="relative border-b border-white/[0.06] px-4 py-3">
      <motion.div
        role="button"
        aria-pressed={autoSend}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleToggleKeyDown}
        whileTap={{ scale: 0.992 }}
        className={cn(
          'group relative w-full overflow-hidden rounded-[1.7rem] border px-4 py-3.5 text-left transition-all duration-500 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
          autoSend
            ? 'border-emerald-500/28'
            : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]'
        )}
        style={
          autoSend
            ? {
                background:
                  'linear-gradient(145deg, rgba(16,185,129,0.16), rgba(16,185,129,0.04) 55%, rgba(255,255,255,0.02))',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 28px -16px rgba(16,185,129,0.45)'
              }
            : {
                background:
                  'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015) 60%, rgba(255,255,255,0.01))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 16px 28px -20px rgba(0,0,0,0.5)'
              }
        }
      >
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[1.7rem]"
          animate={{
            opacity: autoSend ? 1 : 0.65,
            scale: autoSend ? 1 : 0.985
          }}
          transition={{ duration: 0.34, ease: 'easeOut' }}
          style={{
            background: autoSend
              ? 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.14), transparent 38%)'
              : 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.05), transparent 38%)'
          }}
        />

        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full blur-2xl"
          animate={{
            opacity: autoSend ? 0.9 : 0.25,
            scale: autoSend ? 1 : 0.72,
            x: autoSend ? -6 : 10,
            y: autoSend ? -2 : 6
          }}
          transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          style={{
            background: autoSend ? 'rgba(16,185,129,0.28)' : 'rgba(255,255,255,0.08)'
          }}
        />

        <motion.div
          layout={shouldAnimateLayout}
          className="relative z-10 flex items-start justify-between gap-4"
        >
          <motion.div layout={shouldAnimateLayout} className="min-w-0">
            <motion.div layout={shouldAnimateLayout} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'text-[13px] font-semibold tracking-[0.01em] leading-none transition-colors duration-500',
                  autoSend ? 'text-emerald-50' : 'text-white/82 group-hover:text-white'
                )}
              >
                {t('auto_send')}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={autoSend ? 'on' : 'off'}
                  initial={{ opacity: 0, y: autoSend ? 6 : -6, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: autoSend ? -6 : 6, scale: 0.92 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={cn(
                    'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                    autoSend
                      ? 'bg-emerald-400/16 text-emerald-300 ring-1 ring-emerald-400/18'
                      : 'bg-white/[0.05] text-white/42 ring-1 ring-white/8'
                  )}
                >
                  {autoSend ? t('auto_send_state_on') : t('auto_send_state_off')}
                </motion.span>
              </AnimatePresence>
            </motion.div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={autoSend ? 'hint-on' : 'hint-off'}
                initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className={cn(
                  'mt-2 text-[11px] leading-5',
                  autoSend ? 'text-emerald-100/72' : 'text-white/44'
                )}
              >
                {autoSend ? t('auto_send_hint_on') : t('auto_send_hint_off')}
              </motion.p>
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {autoSend ? (
                <motion.div
                  key="submit-cta"
                  layout={shouldAnimateLayout}
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ type: 'spring', stiffness: 230, damping: 22 }}
                  className="mt-3 overflow-hidden"
                >
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onSubmit()
                    }}
                    disabled={isSubmitting || isSubmitDisabled}
                    className="rounded-full border-0 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-40"
                    style={{
                      background: `linear-gradient(135deg, ${accentStrong}, rgba(255,255,255,0.18))`
                    }}
                  >
                    {isSubmitting ? t('sending_to_ai') : t('send_to_ai')}
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>

          <motion.span
            aria-hidden="true"
            animate={{
              scale: autoSend ? 1.08 : 1,
              backgroundColor: autoSend ? 'rgba(74, 222, 128, 1)' : 'rgba(255,255,255,0.18)',
              boxShadow: autoSend ? '0 0 22px rgba(16,185,129,0.55)' : '0 0 0 rgba(0,0,0,0)'
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
          />
        </motion.div>

        <AnimatePresence initial={false}>
          {autoSend ? (
            <motion.div
              aria-hidden="true"
              key="active-outline"
              className="pointer-events-none absolute inset-[1px] rounded-[1.6rem] border border-emerald-300/10"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.015 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            />
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default memo(AiSendComposerToggle)
