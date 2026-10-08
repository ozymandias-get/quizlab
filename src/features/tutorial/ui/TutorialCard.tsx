import { Button } from '@shared/ui/components/primitives'

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
    <motion.div className="border-border/60 bg-card hover:bg-muted/50 relative rounded-xl border p-5 transition-colors">
      {isCompleted && (
        <div className="absolute top-4 right-4">
          <div className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-full px-2.5 py-0.5">
            <CheckCircle2 aria-hidden className="h-3 w-3 text-emerald-500" />
            <span className="text-ql-10 tracking-ql-label font-semibold uppercase">
              {completedLabel}
            </span>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
        >
          <BookOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 pr-16">
          <h3 className="text-ql-13 text-foreground mb-0.5 truncate font-semibold">{title}</h3>
          <p className="text-ql-12 text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="border-border/60 flex items-center justify-between border-t pt-3.5">
        <div className="text-muted-foreground flex items-center gap-1.5">
          <Clock aria-hidden className="h-3.5 w-3.5" />
          <span className="text-ql-12 tabular-nums">{tutorial.estimatedMinutes} min</span>
          <span aria-hidden>·</span>
          <span className="text-ql-12 tabular-nums">{tutorial.steps.length} steps</span>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={handleStart} className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          <span className="text-ql-12">{isCompleted ? replayLabel : startLabel}</span>
        </Button>
      </div>
    </motion.div>
  )
})

export default TutorialCard
