import { useCallback, useMemo } from 'react'

import { getTutorial } from '../model/tutorialDefinitions'
import type { TutorialStep } from '../model/types'
import { useTutorialStore } from '../store/tutorialStore'

interface UseTutorialControllerResult {
  readonly currentStep: number
  readonly totalSteps: number
  readonly stepConfig: TutorialStep | undefined
  readonly targetIds: readonly string[]
  readonly isFirstStep: boolean
  readonly isLastStep: boolean
  readonly tutorialId: string | null
  readonly next: () => void
  readonly prev: () => void
  readonly skip: () => void
  readonly finish: () => void
  readonly goToStep: (step: number) => void
  readonly isCompleted: boolean
}

export function useTutorialController(): UseTutorialControllerResult {
  const activeTutorialId = useTutorialStore((s) => s.activeTutorialId)
  const currentStep = useTutorialStore((s) => s.currentStep)
  const completedTutorials = useTutorialStore((s) => s.completedTutorials)
  const nextStep = useTutorialStore((s) => s.nextStep)
  const prevStep = useTutorialStore((s) => s.prevStep)
  const setStep = useTutorialStore((s) => s.setStep)
  const skipTutorial = useTutorialStore((s) => s.skipTutorial)
  const finishTutorial = useTutorialStore((s) => s.finishTutorial)

  const definition = useMemo(
    () => (activeTutorialId ? getTutorial(activeTutorialId) : undefined),
    [activeTutorialId]
  )

  const steps = definition?.steps ?? []
  const totalSteps = steps.length
  const stepConfig = steps[currentStep] as TutorialStep | undefined

  const targetIds = useMemo(() => {
    if (!stepConfig) return []
    if (stepConfig.targetId) return [stepConfig.targetId]
    return []
  }, [stepConfig])

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep >= totalSteps - 1

  const next = useCallback(() => {
    if (isLastStep) {
      finishTutorial()
    } else {
      stepConfig?.afterStep?.()
      nextStep()
    }
  }, [isLastStep, finishTutorial, stepConfig, nextStep])

  const prev = useCallback(() => {
    prevStep()
  }, [prevStep])

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setStep(step)
      }
    },
    [setStep, totalSteps]
  )

  const isCompleted = activeTutorialId ? completedTutorials[activeTutorialId] === true : false

  return {
    currentStep,
    totalSteps,
    stepConfig,
    targetIds,
    isFirstStep,
    isLastStep,
    tutorialId: activeTutorialId,
    next,
    prev,
    skip: skipTutorial,
    finish: finishTutorial,
    goToStep,
    isCompleted
  }
}
