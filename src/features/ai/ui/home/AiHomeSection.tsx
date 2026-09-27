import { DURATION } from '@shared/lib/motion'

import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, type ReactNode, useState } from 'react'

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
  const handleToggle = () => setIsOpen((current) => !current)

  return (
    <section className="border-border/60 bg-card/30 overflow-hidden rounded-2xl border">
      <button
        type="button"
        aria-expanded={isOpen}
        className="hover:bg-muted/40 focus-visible:ring-ring flex w-full cursor-pointer items-center gap-2.5 px-4 pt-4 pb-3 text-left transition-colors select-none focus-visible:ring-1 focus-visible:outline-none"
        onClick={handleToggle}
      >
        <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-ql-13 text-foreground truncate font-semibold">{title}</span>
            {count > 0 && (
              <span className="bg-muted text-muted-foreground text-ql-11 rounded-full px-1.5 tabular-nums">
                {count}
              </span>
            )}
          </div>
          <div className="text-ql-12 text-muted-foreground mt-0.5">{detail}</div>
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
            transition={{ duration: DURATION.slow, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden will-change-[height,opacity]"
          >
            <div className="bg-border mx-4 h-px" />
            <div className="px-4 pt-3 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
})

export default AiHomeSection
