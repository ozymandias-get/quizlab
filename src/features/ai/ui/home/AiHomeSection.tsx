import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, type ReactNode, useState } from 'react'

interface AiHomeSectionProps {
  accent: string
  children: ReactNode
  defaultOpen?: boolean
  detail: string
  icon: ReactNode
  title: string
}

const AiHomeSection = memo(function AiHomeSection({
  children,
  defaultOpen = true,
  detail,
  icon,
  title
}: AiHomeSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const handleToggle = () => setIsOpen((current) => !current)

  return (
    <section>
      <button
        type="button"
        aria-expanded={isOpen}
        className="hover:bg-card focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors select-none focus-visible:ring-1 focus-visible:outline-none"
        onClick={handleToggle}
      >
        <div className="bg-card text-muted-foreground/80 flex h-8 w-8 items-center justify-center rounded-md">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ql-12 text-foreground/80 font-medium tracking-tight">{title}</div>
          <div className="text-ql-12 text-muted-foreground mt-0.5">{detail}</div>
        </div>
        <div
          className="text-muted-foreground flex h-6 w-6 items-center justify-center transition-transform duration-200"
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
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden will-change-[height,opacity]"
          >
            <div className="px-1 pt-3 pb-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
})

export default AiHomeSection
