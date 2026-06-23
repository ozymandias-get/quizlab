import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface TutorialState {
  activeTutorialId: string | null
  currentStep: number
  completedTutorials: Record<string, boolean>
  onboardingDone: boolean

  startTutorial: (id: string) => void
  closeTutorial: () => void
  nextStep: () => void
  prevStep: () => void
  setStep: (step: number) => void
  skipTutorial: () => void
  finishTutorial: () => void
  markComplete: (tutorialId: string) => void
  resetProgress: () => void
  markOnboardingDone: () => void
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      activeTutorialId: null,
      currentStep: 0,
      completedTutorials: {},
      onboardingDone: false,

      startTutorial: (id) => set({ activeTutorialId: id, currentStep: 0 }),

      closeTutorial: () => set({ activeTutorialId: null, currentStep: 0 }),

      nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),

      prevStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),

      setStep: (step) => set({ currentStep: step }),

      skipTutorial: () => set({ activeTutorialId: null, currentStep: 0 }),

      finishTutorial: () =>
        set((state) => ({
          activeTutorialId: null,
          currentStep: 0,
          completedTutorials: state.activeTutorialId
            ? { ...state.completedTutorials, [state.activeTutorialId]: true }
            : state.completedTutorials
        })),

      markComplete: (tutorialId) =>
        set((state) => ({
          completedTutorials: { ...state.completedTutorials, [tutorialId]: true }
        })),

      resetProgress: () => set({ completedTutorials: {}, onboardingDone: false }),

      markOnboardingDone: () => set({ onboardingDone: true })
    }),
    {
      name: 'tutorial-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        completedTutorials: state.completedTutorials,
        onboardingDone: state.onboardingDone
      })
    }
  )
)
