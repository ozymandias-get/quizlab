import { motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'

interface TutorialHighlightProps {
  rect: DOMRect | null
  color?: string
  isActive?: boolean
}

const TutorialHighlight = memo(function TutorialHighlight({
  rect,
  color = '#3b82f6',
  isActive = true
}: TutorialHighlightProps) {
  const prefersReducedMotion = useReducedMotion() ?? false

  if (!rect || !isActive) return null

  return (
    <div
      className="z-top pointer-events-none fixed"
      style={{
        left: rect.left - 12,
        top: rect.top - 12,
        width: rect.width + 24,
        height: rect.height + 24
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        className="absolute inset-0 rounded-2xl"
        style={{
          border: `2px solid ${color}`,
          boxShadow: `0 0 0 2px ${color}20`
        }}
      />
      {!prefersReducedMotion && (
        <motion.div
          animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-2xl"
          style={{
            backgroundColor: `${color}10`,
            boxShadow: `0 0 30px 5px ${color}30`
          }}
        />
      )}
      {[
        'top-0 left-0 border-t-4 border-l-4',
        'top-0 right-0 border-t-4 border-r-4',
        'bottom-0 left-0 border-b-4 border-l-4',
        'bottom-0 right-0 border-b-4 border-r-4'
      ].map((cls, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={`absolute h-4 w-4 rounded-sm ${cls}`}
          style={{ borderColor: color }}
        />
      ))}
    </div>
  )
})

export default TutorialHighlight
