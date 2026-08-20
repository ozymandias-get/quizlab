import type { QuickPresetItem } from '@features/ai'

import { Button } from '@app/components/ui/button'
import { Input } from '@app/components/ui/input'
import { Label } from '@app/components/ui/label'
import { Textarea } from '@app/components/ui/textarea'
import { cn } from '@shared/lib/uiUtils'

import { RotateCcw } from 'lucide-react'
import { memo, useCallback } from 'react'
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
  const Icon = preset.icon

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({ label: e.target.value })
    },
    [onUpdate]
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
        'bg-card border-border/80 relative flex flex-col gap-3 rounded-xl border p-3.5 shadow-xs transition-colors',
        preset.isCustomized && 'border-primary/40 bg-card/90'
      )}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="border-border bg-muted/60 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
            <Icon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-ql-12 text-foreground truncate font-semibold">
                {preset.label || preset.defaultLabel}
              </span>
              <span
                className={cn(
                  'text-ql-10 rounded border px-1.5 py-0.5 font-medium',
                  preset.isPrimary
                    ? 'bg-primary/10 border-primary/25 text-primary'
                    : 'bg-muted border-border text-muted-foreground'
                )}
              >
                {preset.isPrimary ? t('quick_preset_primary_badge') : t('quick_preset_more_badge')}
              </span>
              {preset.isCustomized && (
                <span className="text-ql-10 bg-muted border-border text-foreground/80 rounded border px-1.5 py-0.5 font-medium">
                  {t('quick_preset_customized_badge')}
                </span>
              )}
            </div>
          </div>
        </div>

        {preset.isCustomized && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground text-ql-10 gap-1 px-2"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{t('quick_preset_reset')}</span>
          </Button>
        )}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-ql-10 text-muted-foreground font-medium">
            {t('quick_preset_label')}
          </Label>
          <Input
            value={preset.label}
            onChange={handleLabelChange}
            placeholder={preset.defaultLabel}
            className="text-ql-11"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-ql-10 text-muted-foreground font-medium">
            {t('quick_preset_prompt')}
          </Label>
          <Textarea
            value={preset.value}
            onChange={handleValueChange}
            placeholder={preset.defaultValue}
            rows={2}
            className="text-ql-11 min-h-[52px] resize-y py-1.5"
          />
        </div>
      </div>
    </div>
  )
})
