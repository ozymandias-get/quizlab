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
    <div className="space-y-8 pb-4">
      <div className="space-y-2">
        <h2 className="text-ql-20 font-black tracking-tight text-white/90">
          {t('tutorial_center_title')}
        </h2>
        <p className="text-ql-14 text-white/50">{t('tutorial_center_desc')}</p>
      </div>

      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const categoryTutorials = grouped.get(category)
          if (!categoryTutorials || categoryTutorials.length === 0) return null

          return (
            <div key={category} className="space-y-4">
              <h3 className="text-ql-13 tracking-ql-caps font-bold text-white/40 uppercase">
                {t(CATEGORY_LABELS[category])}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {categoryTutorials.map((tutorial) => (
                  <TutorialCard
                    key={tutorial.id}
                    tutorial={tutorial}
                    isCompleted={completedTutorials[tutorial.id] === true}
                    onStart={onStartTutorial}
                    title={t(tutorial.titleKey)}
                    description={t(tutorial.descriptionKey)}
                    replayLabel={t('tutorial_replay')}
                    startLabel={t('tutorial_step_next')}
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
          className="border-t border-white/5 pt-6"
        >
          <button
            onClick={handleReset}
            className="text-ql-13 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-5 py-2.5 font-semibold text-rose-400/70 transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <RotateCcw className="h-4 w-4" />
            {t('tutorial_center_reset')}
          </button>
        </motion.div>
      )}
    </div>
  )
})

export default TutorialCenter
