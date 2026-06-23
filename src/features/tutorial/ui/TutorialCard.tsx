import { BookOpen, CheckCircle2, Clock, Play } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback } from 'react'

import type { TutorialDefinition } from '../model/types'

interface TutorialCardProps {
  tutorial: TutorialDefinition
  isCompleted: boolean
  onStart: (id: string) => void
  title: string
  description: string
  replayLabel: string
  startLabel: string
  completedLabel: string
}

const TutorialCard = memo(function TutorialCard({
  tutorial,
  isCompleted,
  onStart,
  title,
  description,
  replayLabel,
  startLabel,
  completedLabel
}: TutorialCardProps) {
  const handleStart = useCallback(() => {
    onStart(tutorial.id)
  }, [onStart, tutorial.id])

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="relative rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:border-white/[0.12] hover:bg-white/[0.05]"
    >
      {isCompleted && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span className="text-ql-10 font-semibold tracking-wider text-emerald-400 uppercase">
              {completedLabel}
            </span>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/10 bg-gradient-to-br from-amber-400/20 to-orange-500/20">
          <BookOpen className="h-5 w-5 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-ql-16 mb-1 font-bold text-white/90">{title}</h3>
          <p className="text-ql-13 line-clamp-2 leading-relaxed text-white/50">{description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-4">
        <div className="flex items-center gap-1.5 text-white/30">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-ql-12 font-medium">{tutorial.estimatedMinutes} min</span>
          <span className="text-ql-12 mx-1">·</span>
          <span className="text-ql-12 font-medium">{tutorial.steps.length} steps</span>
        </div>

        <button
          onClick={handleStart}
          className="group text-ql-13 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 font-semibold text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          <Play className="h-3.5 w-3.5" />
          {isCompleted ? replayLabel : startLabel}
        </button>
      </div>
    </motion.div>
  )
})

export default TutorialCard
