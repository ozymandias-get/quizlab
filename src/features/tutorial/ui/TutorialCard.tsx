import { Button } from '@app/components/ui/button'

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
      whileHover={{ scale: 1.005 }}
      className="border-border bg-card hover:border-border/80 relative rounded-xl border p-5 shadow-xs transition-colors"
    >
      {isCompleted && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span className="text-ql-10 tracking-ql-label font-semibold text-emerald-600 uppercase dark:text-emerald-400">
              {completedLabel}
            </span>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-start gap-3.5">
        <div className="border-primary/20 bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-xs">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pr-16">
          <h3 className="text-ql-15 text-foreground mb-0.5 font-semibold">{title}</h3>
          <p className="text-ql-13 text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="border-border flex items-center justify-between border-t pt-3.5">
        <div className="text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-ql-12 font-medium">{tutorial.estimatedMinutes} min</span>
          <span className="text-ql-12 mx-1">·</span>
          <span className="text-ql-12 font-medium">{tutorial.steps.length} steps</span>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={handleStart} className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          <span>{isCompleted ? replayLabel : startLabel}</span>
        </Button>
      </div>
    </motion.div>
  )
})

export default TutorialCard
