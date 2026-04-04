import { motion } from 'framer-motion'
import { TAB_STRIP_CHROME_BTN } from '@shared/ui/tabStripChrome'

interface AiTabStripHomeButtonProps {
  showHome?: boolean
  title: string
  onShowHome?: () => void
}

function AiTabStripHomeButton({ showHome, title, onShowHome }: AiTabStripHomeButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onShowHome}
      whileHover={{ scale: 1.04, y: -0.5 }}
      whileTap={{ scale: 0.96 }}
      title={title}
      aria-label={title}
      className={`${TAB_STRIP_CHROME_BTN} relative overflow-hidden`}
      style={
        showHome
          ? {
              background: 'linear-gradient(145deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
              borderColor: 'rgba(16,185,129,0.48)',
              boxShadow: '0 0 18px -8px rgba(16,185,129,0.38), inset 0 1px 0 rgba(255,255,255,0.1)'
            }
          : undefined
      }
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={showHome ? 'rgba(52,211,153,0.95)' : 'rgba(255,255,255,0.72)'}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </motion.button>
  )
}

export default AiTabStripHomeButton
