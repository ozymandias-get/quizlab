import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage } from '@shared/hooks/useLocalStorage'

import {
  BookOpen,
  Cpu,
  FileText,
  HelpCircle,
  Layers,
  type LucideIcon,
  RotateCcw,
  Sparkles,
  Stethoscope
} from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export type QuickPresetKey =
  | 'explain'
  | 'summarize'
  | 'quiz'
  | 'flashcard'
  | 'terms'
  | 'mechanism'
  | 'clinical'
  | 'review'

export interface QuickPresetConfig {
  key: QuickPresetKey
  defaultLabelKey: string
  defaultValueKey: string
  icon: LucideIcon
  isPrimary: boolean
}

export const QUICK_PRESET_CONFIGS: QuickPresetConfig[] = [
  {
    key: 'explain',
    defaultLabelKey: 'ai_preset_explain',
    defaultValueKey: 'ai_preset_explain_value',
    icon: Sparkles,
    isPrimary: true
  },
  {
    key: 'summarize',
    defaultLabelKey: 'ai_preset_summarize',
    defaultValueKey: 'ai_preset_summarize_value',
    icon: FileText,
    isPrimary: true
  },
  {
    key: 'quiz',
    defaultLabelKey: 'ai_preset_quiz',
    defaultValueKey: 'ai_preset_quiz_value',
    icon: HelpCircle,
    isPrimary: true
  },
  {
    key: 'flashcard',
    defaultLabelKey: 'ai_preset_flashcard',
    defaultValueKey: 'ai_preset_flashcard_value',
    icon: Layers,
    isPrimary: false
  },
  {
    key: 'terms',
    defaultLabelKey: 'ai_preset_terms',
    defaultValueKey: 'ai_preset_terms_value',
    icon: BookOpen,
    isPrimary: false
  },
  {
    key: 'mechanism',
    defaultLabelKey: 'ai_preset_mechanism',
    defaultValueKey: 'ai_preset_mechanism_value',
    icon: Cpu,
    isPrimary: false
  },
  {
    key: 'clinical',
    defaultLabelKey: 'ai_preset_clinical',
    defaultValueKey: 'ai_preset_clinical_value',
    icon: Stethoscope,
    isPrimary: false
  },
  {
    key: 'review',
    defaultLabelKey: 'ai_preset_review',
    defaultValueKey: 'ai_preset_review_value',
    icon: RotateCcw,
    isPrimary: false
  }
]

export type CustomPresetsRecord = Partial<
  Record<
    QuickPresetKey,
    {
      label?: string
      value?: string
    }
  >
>

export interface QuickPresetItem {
  key: QuickPresetKey
  label: string
  value: string
  defaultLabel: string
  defaultValue: string
  isCustomized: boolean
  isPrimary: boolean
  icon: LucideIcon
}

export function useQuickAiPresets() {
  const { t } = useTranslation()
  const [customPresets, setCustomPresets] = useLocalStorage<CustomPresetsRecord>(
    STORAGE_KEYS.QUICK_AI_PRESETS,
    {}
  )

  const presets: QuickPresetItem[] = useMemo(() => {
    return QUICK_PRESET_CONFIGS.map((config) => {
      const defaultLabel = t(config.defaultLabelKey)
      const defaultValue = t(config.defaultValueKey)
      const saved = customPresets[config.key]

      const customLabel = saved?.label?.trim()
      const customValue = saved?.value?.trim()

      const isLabelCustomized = Boolean(customLabel && customLabel !== defaultLabel)
      const isValueCustomized = Boolean(customValue && customValue !== defaultValue)

      return {
        key: config.key,
        label: isLabelCustomized ? customLabel! : defaultLabel,
        value: isValueCustomized ? customValue! : defaultValue,
        defaultLabel,
        defaultValue,
        isCustomized: isLabelCustomized || isValueCustomized,
        isPrimary: config.isPrimary,
        icon: config.icon
      }
    })
  }, [customPresets, t])

  const primaryPresets = useMemo(() => presets.filter((p) => p.isPrimary), [presets])
  const secondaryPresets = useMemo(() => presets.filter((p) => !p.isPrimary), [presets])

  const hasAnyCustomized = useMemo(() => presets.some((p) => p.isCustomized), [presets])

  const updatePreset = useCallback(
    (key: QuickPresetKey, updates: { label?: string; value?: string }) => {
      setCustomPresets((prev) => {
        const next = { ...prev }
        const existing = next[key] || {}
        next[key] = {
          label: updates.label !== undefined ? updates.label : existing.label,
          value: updates.value !== undefined ? updates.value : existing.value
        }
        return next
      })
    },
    [setCustomPresets]
  )

  const resetPreset = useCallback(
    (key: QuickPresetKey) => {
      setCustomPresets((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [setCustomPresets]
  )

  const resetAllPresets = useCallback(() => {
    setCustomPresets({})
  }, [setCustomPresets])

  return {
    presets,
    primaryPresets,
    secondaryPresets,
    hasAnyCustomized,
    updatePreset,
    resetPreset,
    resetAllPresets
  }
}
