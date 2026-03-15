import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Grip } from 'lucide-react'
import { useLanguage } from '@app/providers'
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
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay }}
      className="overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_52%,rgba(0,0,0,0.16))] backdrop-blur-2xl"
    >
      <div
        className="flex cursor-pointer select-none flex-wrap items-center gap-3.5 px-5 py-4 transition-colors hover:bg-white/[0.02]"
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
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-white/35 font-medium">
            {title}
          </div>
          <div className="mt-0.5 text-[13px] text-white/56">{detail}</div>
        </div>
        <div
          className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/28 cursor-default"
          onClick={(event) => event.stopPropagation()}
        >
          <Grip className="h-3.5 w-3.5" />
          {t('ai_home.drag_drop')}
        </div>
        <div
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] text-white/40 transition-transform duration-300"
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
