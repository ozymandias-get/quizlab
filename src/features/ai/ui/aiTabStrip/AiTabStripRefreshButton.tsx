import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

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
      whileHover={disabled ? undefined : { scale: 1.08, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      title={title}
      aria-label={title}
      className="relative flex items-center justify-center w-8 h-8 rounded-xl border shrink-0 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-35"
      style={
        disabled
          ? {
              background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              borderColor: 'rgba(255,255,255,0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
            }
          : {
              background: 'linear-gradient(145deg, rgba(56,189,248,0.16), rgba(14,165,233,0.08))',
              borderColor: 'rgba(56,189,248,0.35)',
              boxShadow: '0 0 12px -4px rgba(56,189,248,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'
            }
      }
    >
      <RefreshCw
        className={`h-[13px] w-[13px] ${disabled ? 'text-white/35' : 'text-sky-300'}`}
        strokeWidth={2.2}
      />
    </motion.button>
  )
}

export default AiTabStripRefreshButton
