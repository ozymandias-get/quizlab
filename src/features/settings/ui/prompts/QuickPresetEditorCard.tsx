import type { QuickPresetItem } from '@features/ai'

import { Button } from '@app/components/ui/button'
import { Input } from '@app/components/ui/input'
import { Label } from '@app/components/ui/label'
import { Textarea } from '@app/components/ui/textarea'
import { cn } from '@shared/lib/uiUtils'

import { RotateCcw } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface QuickPresetEditorCardProps {
  preset: QuickPresetItem
  onUpdate: (updates: { label?: string; value?: string }) => void
  onReset: () => void
}

export const QuickPresetEditorCard = memo(function QuickPresetEditorCard({
  preset,
  onUpdate,
  onReset
}: QuickPresetEditorCardProps) {
  const { t } = useTranslation()
  const [labelError, setLabelError] = useState('')
  const Icon = preset.icon

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({ label: e.target.value })
      if (labelError) setLabelError(e.target.value.trim() ? '' : 'error_name_required')
    },
    [labelError, onUpdate]
  )

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate({ value: e.target.value })
    },
    [onUpdate]
  )

  return (
    <div
      className={cn(
        'border-border/60 bg-card flex flex-col gap-3 rounded-xl border p-4',
        preset.isCustomized && 'border-ring/50 bg-accent/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-ql-13 text-foreground truncate font-semibold">
            {preset.label || preset.defaultLabel}
          </span>
          <span className="text-ql-10 text-muted-foreground hidden shrink-0 sm:inline">
            · {preset.isPrimary ? t('preset_primary_short') : t('preset_menu_short')}
          </span>
        </div>
        {preset.isCustomized && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onReset}
            className="shrink-0 gap-1 px-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="text-ql-10 text-muted-foreground">{t('reset')}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr]">
        <div className="text-ql-12 space-y-1">
          <Label className="text-ql-10 text-muted-foreground">{t('prompt_label')}</Label>
          <Input
            value={preset.label}
            onChange={handleLabelChange}
            onBlur={() => setLabelError(preset.label.trim() ? '' : 'error_name_required')}
            placeholder={preset.defaultLabel}
            className="h-7"
            aria-invalid={!!labelError}
          />
          {labelError && (
            <span role="alert" className="text-destructive text-ql-11 px-1">
              {t(labelError)}
            </span>
          )}
        </div>
        <div className="text-ql-12 space-y-1">
          <Label className="text-ql-10 text-muted-foreground">{t('prompt_prompt')}</Label>
          <Textarea
            value={preset.value}
            onChange={handleValueChange}
            placeholder={preset.defaultValue}
            rows={1}
            className="min-h-[30px] py-1.5 leading-snug"
          />
        </div>
      </div>
    </div>
  )
})
