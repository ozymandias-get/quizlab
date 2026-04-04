import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { TAB_STRIP_CHROME_BTN } from '@shared/ui/tabStripChrome'

interface AiTabStripRefreshButtonProps {
  disabled?: boolean
  title: string
  onRefresh: () => void
}

function AiTabStripRefreshButton({ disabled, title, onRefresh }: AiTabStripRefreshButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onRefresh()
      }}
      whileHover={disabled ? undefined : { scale: 1.04, y: -0.5 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      title={title}
      aria-label={title}
      className={`${TAB_STRIP_CHROME_BTN} relative overflow-hidden`}
      style={
        disabled
          ? {
              background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              borderColor: 'rgba(255,255,255,0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
            }
          : {
              background: 'linear-gradient(145deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))',
              borderColor: 'rgba(16,185,129,0.38)',
              boxShadow: '0 0 14px -6px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
            }
      }
    >
      <RefreshCw
        className={`h-[13px] w-[13px] ${disabled ? 'text-white/35' : 'text-emerald-300/90'}`}
        strokeWidth={2.2}
      />
    </motion.button>
  )
}

export default AiTabStripRefreshButton
