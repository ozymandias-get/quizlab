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
        'bg-card border-border/70 flex flex-col gap-2 rounded-lg border px-3 py-2.5 transition-colors',
        preset.isCustomized && 'border-primary/30 bg-primary/[0.04]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-muted text-muted-foreground border-border/50 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
            <Icon className="size-3 w-3" />
          </span>
          <span className="text-ql-12 text-foreground truncate font-medium">
            {preset.label || preset.defaultLabel}
          </span>
          <span className="text-ql-10 text-muted-foreground/60 hidden sm:inline">
            · {preset.isPrimary ? t('preset_primary_short') : t('preset_menu_short')}
          </span>
        </div>
        {preset.isCustomized && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onReset}
            className="text-ql-10 text-muted-foreground h-6 gap-1 px-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            {t('reset')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr]">
        <div className="space-y-1">
          <Label className="text-ql-10 text-muted-foreground/70">{t('prompt_label')}</Label>
          <Input
            value={preset.label}
            onChange={handleLabelChange}
            placeholder={preset.defaultLabel}
            className="text-ql-12 h-7"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-ql-10 text-muted-foreground/70">{t('prompt_prompt')}</Label>
          <Textarea
            value={preset.value}
            onChange={handleValueChange}
            placeholder={preset.defaultValue}
            rows={1}
            className="text-ql-12 min-h-[30px] resize-none py-1.5 leading-snug"
          />
        </div>
      </div>
    </div>
  )
})
