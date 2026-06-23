import { memo, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useTourTargetRects } from '../hooks/useTourTargetRects'
import { useTutorialController } from '../hooks/useTutorialController'
import { calculatePlacement } from '../lib/placement'
import { getTutorial } from '../model/tutorialDefinitions'
import TutorialHighlight from './TutorialHighlight'
import TutorialTooltip from './TutorialTooltip'

interface TutorialOverlayProps {
  tutorialId: string
  isActive: boolean
  onClose: () => void
}

const HIGHLIGHT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

const TutorialOverlay = memo(function TutorialOverlay({
  tutorialId,
  isActive,
  onClose
}: TutorialOverlayProps) {
  const { t } = useTranslation()
  const {
    currentStep,
    totalSteps,
    stepConfig,
    targetIds,
    isFirstStep,
    isLastStep,
    next,
    prev,
    skip,
    finish
  } = useTutorialController()

  const definition = useMemo(() => getTutorial(tutorialId), [tutorialId])

  const rects = useTourTargetRects(targetIds, isActive && !!stepConfig)

  const currentRect = useMemo(() => {
    if (targetIds.length === 0) return null
    const firstId = targetIds[0]
    return rects.get(firstId) ?? null
  }, [targetIds, rects])

  const tooltipPlacement = useMemo(
    () =>
      calculatePlacement(currentRect, stepConfig?.placement ?? (currentRect ? 'auto' : 'center')),
    [currentRect, stepConfig?.placement]
  )

  const handleBeforeStep = useCallback(() => {
    stepConfig?.beforeStep?.()
  }, [stepConfig])

  useEffect(() => {
    if (isActive && stepConfig) {
      handleBeforeStep()
    }
  }, [isActive, currentStep, handleBeforeStep, stepConfig])

  useEffect(() => {
    if (!isActive) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [isActive, onClose])

  if (!isActive || !definition) return null

  const title = stepConfig ? t(stepConfig.titleKey) : ''
  const body = stepConfig ? t(stepConfig.bodyKey) : ''
  const color = HIGHLIGHT_COLORS[currentStep % HIGHLIGHT_COLORS.length]

  return (
    <div className="z-top pointer-events-none fixed inset-0">
      {currentRect && <TutorialHighlight rect={currentRect} color={color} />}

      <div style={{ pointerEvents: 'auto' }}>
        <TutorialTooltip
          step={currentStep}
          totalSteps={totalSteps}
          title={title}
          body={body}
          onNext={next}
          onBack={prev}
          onSkip={skip}
          onFinish={finish}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          nextLabel={t('tutorial_step_next')}
          backLabel={t('tutorial_step_back')}
          skipLabel={t('tutorial_step_skip')}
          finishLabel={t('tutorial_step_finish')}
          style={tooltipPlacement as React.CSSProperties}
        />
      </div>
    </div>
  )
})

export default TutorialOverlay
