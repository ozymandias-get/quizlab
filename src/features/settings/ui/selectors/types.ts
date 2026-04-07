import type {
  AiPlatform,
  AiSelectorConfig,
  AutomationExecutionDiagnostics,
  SelectorHealth,
  SubmitMode
} from '@shared-core/types'

export interface SelectorsTabProps {
  onCloseSettings?: () => void
}

export interface SelectorEntry {
  hostname: string
  config: AiSelectorConfig
}

export interface ValidationState {
  status: 'idle' | 'loading' | 'success' | 'error'
  error?: string | null
  diagnostics?: AutomationExecutionDiagnostics | null
}

export interface SubmitModeOption {
  value: SubmitMode
  labelKey: string
}

export interface AiEntry {
  key: string
  ai: AiPlatform
}

export interface HealthTone {
  badge: string
  icon: string
  border: string
}

export type SelectorHealthState = SelectorHealth | 'missing'

export type TranslateFn = (key: string, params?: unknown) => string
