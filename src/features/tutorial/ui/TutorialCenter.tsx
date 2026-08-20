import { Button } from '@app/components/ui/button'

import { RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getAllTutorials } from '../model/tutorialDefinitions'
import type { TutorialCategory } from '../model/types'
import { useTutorialStore } from '../store/tutorialStore'
import TutorialCard from './TutorialCard'

const CATEGORY_ORDER: TutorialCategory[] = [
  'onboarding',
  'general',
  'pdf',
  'ai',
  'automation',
  'settings'
]

const CATEGORY_LABELS: Record<TutorialCategory, string> = {
  onboarding: 'tutorial_category_onboarding',
  general: 'tutorial_category_general',
  pdf: 'tutorial_category_pdf',
  ai: 'tutorial_category_ai',
  automation: 'tutorial_category_automation',
  settings: 'tutorial_category_settings'
}

interface TutorialCenterProps {
  onStartTutorial: (id: string) => void
}

const TutorialCenter = memo(function TutorialCenter({ onStartTutorial }: TutorialCenterProps) {
  const { t } = useTranslation()
  const completedTutorials = useTutorialStore((s) => s.completedTutorials)
  const resetProgress = useTutorialStore((s) => s.resetProgress)

  const tutorials = useMemo(() => getAllTutorials(), [])

  const grouped = useMemo(() => {
    const map = new Map<TutorialCategory, typeof tutorials>()
    for (const tutorial of tutorials) {
      const existing = map.get(tutorial.category) ?? []
      map.set(tutorial.category, [...existing, tutorial])
    }
    return map
  }, [tutorials])

  const handleReset = useCallback(() => {
    resetProgress()
  }, [resetProgress])

  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-1">
        <h2 className="text-ql-20 text-foreground tracking-ql-tight font-bold">
          {t('tutorial_center_title')}
        </h2>
        <p className="text-ql-13 text-muted-foreground">{t('tutorial_center_desc')}</p>
      </div>

      <div className="space-y-6">
        {CATEGORY_ORDER.map((category) => {
          const categoryTutorials = grouped.get(category)
          if (!categoryTutorials || categoryTutorials.length === 0) return null

          return (
            <div key={category} className="space-y-3">
              <h3 className="text-ql-12 text-muted-foreground tracking-ql-caps font-medium uppercase">
                {t(CATEGORY_LABELS[category])}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {categoryTutorials.map((tutorial) => (
                  <TutorialCard
                    key={tutorial.id}
                    tutorial={tutorial}
                    isCompleted={completedTutorials[tutorial.id] === true}
                    onStart={onStartTutorial}
                    title={t(tutorial.titleKey)}
                    description={t(tutorial.descriptionKey)}
                    replayLabel={t('tutorial_replay')}
                    startLabel={t('tut_start')}
                    completedLabel={t('tutorial_completed_badge')}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {Object.keys(completedTutorials).length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-border border-t pt-5"
        >
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t('tutorial_center_reset')}</span>
          </Button>
        </motion.div>
      )}
    </div>
  )
})

export default TutorialCenter
