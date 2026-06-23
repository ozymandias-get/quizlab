export type TutorialCategory = 'onboarding' | 'pdf' | 'ai' | 'automation' | 'settings' | 'general'

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto'

export interface TutorialStep {
  readonly id: string
  readonly titleKey: string
  readonly bodyKey: string
  readonly targetId?: string
  readonly placement?: Placement
  readonly beforeStep?: () => void
  readonly afterStep?: () => void
  readonly actionLabel?: string
  readonly actionOnClick?: () => void
  readonly validation?: () => boolean
}

export interface TutorialDefinition {
  readonly id: string
  readonly titleKey: string
  readonly descriptionKey: string
  readonly category: TutorialCategory
  readonly estimatedMinutes: number
  readonly steps: readonly TutorialStep[]
  readonly icon?: string
  readonly prerequisites?: readonly string[]
}

export interface TutorialEntry {
  readonly definition: TutorialDefinition
  readonly component?: React.ComponentType<TutorialOverlayProps>
}

export interface TutorialOverlayProps {
  readonly tutorialId: string
  readonly isActive: boolean
  readonly onClose: () => void
}
