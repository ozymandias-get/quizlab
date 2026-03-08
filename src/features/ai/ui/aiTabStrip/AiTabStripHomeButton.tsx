import { motion } from 'framer-motion'

interface AiTabStripHomeButtonProps {
    showHome?: boolean
    onShowHome?: () => void
}

function AiTabStripHomeButton({ showHome, onShowHome }: AiTabStripHomeButtonProps) {
    return (
        <motion.button
            type="button"
            onClick={onShowHome}
            whileHover={{ scale: 1.08, y: -1 }}
            whileTap={{ scale: 0.94 }}
            title="Anasayfa"
            className="relative flex items-center justify-center w-8 h-8 rounded-xl border shrink-0 transition-all duration-150"
            style={showHome ? {
                background: 'linear-gradient(145deg, #6ee7b728, #34d39918)',
                borderColor: '#6ee7b755',
                boxShadow: '0 0 14px -5px #6ee7b760, inset 0 1px 0 rgba(255,255,255,0.15)',
            } : {
                background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                borderColor: 'rgba(255,255,255,0.12)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
        >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showHome ? '#6ee7b7' : 'rgba(255,255,255,0.7)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        </motion.button>
    )
}

export default AiTabStripHomeButton
