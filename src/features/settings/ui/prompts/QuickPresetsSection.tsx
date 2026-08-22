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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary border-primary/20 flex h-6 w-6 items-center justify-center rounded-md border">
            <Sparkles className="h-3 w-3" />
          </span>
          <h3 className="text-ql-13 text-foreground font-semibold">
            {t('quick_presets_section_title')}
          </h3>
        </div>
        {hasAnyCustomized && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleResetAll}
            className="text-ql-11 text-muted-foreground h-6 gap-1 px-2"
          >
            <RotateCcw className="h-3 w-3" />
            {t('quick_preset_reset_all')}
          </Button>
        )}
      </div>
      <p className="text-ql-11 text-muted-foreground -mt-1 leading-relaxed">
        {t('quick_presets_section_desc')}
      </p>

      <div className="space-y-2">
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
