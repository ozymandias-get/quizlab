import { type QuickPresetKey, useQuickAiPresets } from '@features/ai'

import { Button } from '@app/components/ui/button'
import { useToastActions } from '@app/providers'

import { RotateCcw, Sparkles } from 'lucide-react'
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
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary h-4 w-4" />
            <h3 className="text-foreground text-ql-14 font-semibold">
              {t('quick_presets_section_title')}
            </h3>
          </div>
          <p className="text-muted-foreground text-ql-12 leading-relaxed">
            {t('quick_presets_section_desc')}
          </p>
        </div>

        {hasAnyCustomized && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="text-muted-foreground hover:text-foreground text-ql-12 h-8 shrink-0 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t('quick_preset_reset_all')}</span>
          </Button>
        )}
      </div>

      {/* Preset Cards */}
      <div className="grid grid-cols-1 gap-3">
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
