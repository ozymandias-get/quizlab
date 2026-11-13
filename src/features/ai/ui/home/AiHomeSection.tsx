import { DURATION } from '@shared/lib/motion'

import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, type ReactNode, useId, useState } from 'react'

interface AiHomeSectionProps {
  children: ReactNode
  count?: number
  defaultOpen?: boolean
  detail: string
  icon: ReactNode
  title: string
}

const AiHomeSection = memo(function AiHomeSection({
  children,
  count = 0,
  defaultOpen = true,
  detail,
  icon,
  title
}: AiHomeSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentId = useId()
  const prefersReducedMotion = useReducedMotion()
  const handleToggle = () => setIsOpen((current) => !current)

  return (
    <section
      className={`overflow-hidden rounded-2xl border transition-colors ${
        isOpen ? 'border-white/[0.09] bg-zinc-950/70' : 'border-white/[0.07] bg-zinc-950/40'
      }`}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? contentId : undefined}
        className="focus-visible:ring-ring/70 flex w-full cursor-pointer items-center gap-2.5 px-4 py-3.5 text-left transition-colors select-none hover:bg-white/[0.03] focus-visible:ring-1 focus-visible:outline-none"
        onClick={handleToggle}
      >
        <div className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-ql-13 text-foreground min-w-0 truncate font-semibold">
              {title}
            </span>
            {count > 0 && (
              <span className="text-ql-11 shrink-0 rounded-full border border-white/[0.07] bg-white/[0.04] px-1.5 text-zinc-400 tabular-nums">
                {count}
              </span>
            )}
          </div>
          <div className="text-ql-12 text-muted-foreground mt-0.5 line-clamp-2">{detail}</div>
        </div>
        <div
          className="text-muted-foreground motion-slow flex size-6 shrink-0 items-center justify-center transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : DURATION.slow,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="overflow-hidden will-change-[height,opacity]"
          >
            <div id={contentId} className="@container px-4 pt-2 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
})

export default AiHomeSection
