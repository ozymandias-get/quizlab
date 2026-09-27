import { Button } from '@app/components/ui/button'
import { SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'

import { BookOpenIcon, RotateCcw } from 'lucide-react'
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
    <div className="space-y-6">
      <SettingsTabIntro
        icon={
          <SettingsTabIcon>
            <BookOpenIcon className="h-5 w-5" />
          </SettingsTabIcon>
        }
        description={t('tutorial_center_desc')}
        title={t('tutorial_center_title')}
      />

      <div className="flex flex-col gap-6">
        {CATEGORY_ORDER.map((category) => {
          const categoryTutorials = grouped.get(category)
          if (!categoryTutorials || categoryTutorials.length === 0) return null

          return (
            <div key={category} className="flex flex-col gap-3">
              <div className="text-muted-foreground flex items-center gap-2">
                <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold uppercase">
                  {t(CATEGORY_LABELS[category])}
                </span>
                <span aria-hidden className="bg-border h-px flex-1" />
              </div>
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
          className="border-border/60 border-t pt-5"
        >
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="text-ql-12">{t('tutorial_center_reset')}</span>
          </Button>
        </motion.div>
      )}
    </div>
  )
})

export default TutorialCenter
