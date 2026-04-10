import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Grip } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import { hexToRgba } from '@shared/lib/uiUtils'

interface AiHomeSectionProps {
  accent: string
  children: ReactNode
  defaultOpen?: boolean
  delay?: number
  detail: string
  icon: ReactNode
  title: string
}

export default function AiHomeSection({
  accent,
  children,
  defaultOpen = true,
  delay = 0,
  detail,
  icon,
  title
}: AiHomeSectionProps) {
  const { t } = useLanguageStrings()
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay }}
      className="glass-tier-2 overflow-hidden rounded-[32px]"
    >
      <div
        className="flex cursor-pointer select-none flex-wrap items-center gap-3.5 px-5 py-4 transition-colors hover:bg-white/[0.03]"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full border shadow-sm"
          style={{
            color: accent,
            borderColor: hexToRgba(accent, 0.22),
            background: `linear-gradient(160deg, ${hexToRgba(accent, 0.16)} 0%, ${hexToRgba(accent, 0.05)} 100%)`
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ql-10 uppercase tracking-ql-section text-white/35 font-medium">
            {title}
          </div>
          <div className="mt-0.5 text-ql-14 text-white/56">{detail}</div>
        </div>
        <div
          className="glass-tier-3 flex h-8 w-8 shrink-0 cursor-default items-center justify-center rounded-full border-white/[0.1] text-white/42 shadow-none"
          title={t('ai_home.drag_drop')}
          aria-label={t('ai_home.drag_drop')}
          onClick={(event) => event.stopPropagation()}
        >
          <Grip className="h-3.5 w-3.5" aria-hidden />
        </div>
        <div
          className="glass-tier-3 ml-1 flex h-7 w-7 items-center justify-center rounded-full border-white/[0.1] text-white/44 transition-transform duration-300 shadow-none"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div className="px-4 pb-4">{children}</div>
      </motion.div>
    </motion.section>
  )
}
