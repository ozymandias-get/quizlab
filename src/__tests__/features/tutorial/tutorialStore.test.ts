import { useTutorialStore } from '@features/tutorial/store/tutorialStore'

import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('tutorialStore', () => {
  beforeEach(() => {
    const store = useTutorialStore.getState()
    store.closeTutorial()
    store.resetProgress()
  })

  it('initializes with default state', () => {
    const state = useTutorialStore.getState()
    expect(state.activeTutorialId).toBeNull()
    expect(state.currentStep).toBe(0)
    expect(state.completedTutorials).toEqual({})
    expect(state.onboardingDone).toBe(false)
  })

  it('starts a tutorial', () => {
    const { startTutorial } = useTutorialStore.getState()
    act(() => startTutorial('general'))

    const state = useTutorialStore.getState()
    expect(state.activeTutorialId).toBe('general')
    expect(state.currentStep).toBe(0)
  })

  it('closes a tutorial', () => {
    const { startTutorial, closeTutorial } = useTutorialStore.getState()
    act(() => startTutorial('general'))
    act(() => closeTutorial())

    const state = useTutorialStore.getState()
    expect(state.activeTutorialId).toBeNull()
    expect(state.currentStep).toBe(0)
  })

  it('advances to next step', () => {
    const { startTutorial, nextStep } = useTutorialStore.getState()
    act(() => startTutorial('pdf'))
    act(() => nextStep())

    expect(useTutorialStore.getState().currentStep).toBe(1)
  })

  it('goes back to previous step', () => {
    const { startTutorial, nextStep, prevStep } = useTutorialStore.getState()
    act(() => startTutorial('pdf'))
    act(() => nextStep())
    act(() => prevStep())

    expect(useTutorialStore.getState().currentStep).toBe(0)
  })

  it('does not go below step 0', () => {
    const { startTutorial, prevStep } = useTutorialStore.getState()
    act(() => startTutorial('pdf'))
    act(() => prevStep())

    expect(useTutorialStore.getState().currentStep).toBe(0)
  })

  it('sets a specific step', () => {
    const { startTutorial, setStep } = useTutorialStore.getState()
    act(() => startTutorial('pdf'))
    act(() => setStep(3))

    expect(useTutorialStore.getState().currentStep).toBe(3)
  })

  it('finishes a tutorial and marks it complete', () => {
    const { startTutorial, finishTutorial } = useTutorialStore.getState()
    act(() => startTutorial('general'))
    act(() => finishTutorial())

    const state = useTutorialStore.getState()
    expect(state.activeTutorialId).toBeNull()
    expect(state.currentStep).toBe(0)
    expect(state.completedTutorials.general).toBe(true)
  })

  it('skips a tutorial without marking complete', () => {
    const { startTutorial, skipTutorial } = useTutorialStore.getState()
    act(() => startTutorial('general'))
    act(() => skipTutorial())

    const state = useTutorialStore.getState()
    expect(state.activeTutorialId).toBeNull()
    expect(state.completedTutorials.general).toBeUndefined()
  })

  it('marks a tutorial complete directly', () => {
    const { markComplete } = useTutorialStore.getState()
    act(() => markComplete('pdf'))

    expect(useTutorialStore.getState().completedTutorials.pdf).toBe(true)
  })

  it('resets all progress', () => {
    const { markComplete, markOnboardingDone, resetProgress } = useTutorialStore.getState()
    act(() => markComplete('general'))
    act(() => markComplete('pdf'))
    act(() => markOnboardingDone())
    act(() => resetProgress())

    const state = useTutorialStore.getState()
    expect(state.completedTutorials).toEqual({})
    expect(state.onboardingDone).toBe(false)
  })

  it('marks onboarding as done', () => {
    const { markOnboardingDone } = useTutorialStore.getState()
    act(() => markOnboardingDone())

    expect(useTutorialStore.getState().onboardingDone).toBe(true)
  })
})
