import { type QuickPresetKey, useQuickAiPresets } from '@features/ai'

import { useToastActions } from '@app/providers'
import { Button } from '@shared/ui/components/primitives'

import { RotateCcw } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { QuickPresetEditorCard } from './QuickPresetEditorCard'

export const QuickPresetsSection = memo(function QuickPresetsSection() {
  const { t } = useTranslation()
  const { showSuccess } = useToastActions()
  const { presets, hasAnyCustomized, updatePreset, resetPreset, resetAllPresets } =
    useQuickAiPresets()

  const handleResetAll = useCallback(() => {
    resetAllPresets()
    showSuccess(t('quick_preset_reset_done'))
  }, [resetAllPresets, showSuccess, t])

  const handleResetOne = useCallback(
    (key: QuickPresetKey) => {
      resetPreset(key)
      showSuccess(t('quick_preset_reset_done'))
    },
    [resetPreset, showSuccess, t]
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2">
        <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold uppercase">
          {t('quick_presets_section_title')}
        </span>
        {hasAnyCustomized && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleResetAll}
            className="shrink-0 gap-1 px-2"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="text-ql-11">{t('quick_preset_reset_all')}</span>
          </Button>
        )}
        <span aria-hidden className="bg-border h-px flex-1" />
      </div>

      <p className="text-ql-12 text-muted-foreground leading-relaxed">
        {t('quick_presets_section_desc')}
      </p>

      <div className="space-y-3">
        {presets.map((preset) => (
          <QuickPresetEditorCard
            key={preset.key}
            preset={preset}
            onUpdate={(updates) => updatePreset(preset.key, updates)}
            onReset={() => handleResetOne(preset.key)}
          />
        ))}
      </div>
    </section>
  )
})
