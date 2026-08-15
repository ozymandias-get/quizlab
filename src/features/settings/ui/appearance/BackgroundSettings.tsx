import { cn } from '@shared/lib/uiUtils'
import type { BackgroundMode } from '@shared/stores/appearanceStore'
import { MagicWandIcon, PaletteIcon } from '@ui/components/Icons'

import { memo } from 'react'

import ColorPicker from '../ColorPicker'

interface BackgroundSettingsProps {
  bgMode: BackgroundMode
  setBgMode: (mode: BackgroundMode) => void
  bgSolidColor: string
  setBgSolidColor: (val: string) => void
  t: (key: string) => string
}

const MODES: { value: BackgroundMode; labelKey: string; icon: typeof MagicWandIcon }[] = [
  { value: 'ambient', labelKey: 'bg_ambient', icon: MagicWandIcon },
  { value: 'solid', labelKey: 'bg_solid', icon: PaletteIcon }
]

const BackgroundSettings = memo(
  ({ bgMode, setBgMode, bgSolidColor, setBgSolidColor, t }: BackgroundSettingsProps) => {
    return (
      <div className="bg-card border-border space-y-5 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted text-muted-foreground/60 border-border rounded-lg border p-2">
              <PaletteIcon className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-ql-14 text-foreground font-bold">{t('background_settings')}</h3>
              <p className="text-ql-11 text-foreground/75 tracking-ql-fine">
                {bgMode === 'solid' ? t('bg_solid_desc') : t('bg_desc')}
              </p>
            </div>
          </div>
        </div>

        <div className="border-border bg-muted/60 flex gap-1.5 rounded-xl border p-1">
          {MODES.map(({ value: mode, labelKey, icon: Icon }) => (
            <button
              type="button"
              key={mode}
              onClick={() => setBgMode(mode)}
              className={cn(
                'text-ql-12 focus-visible:ring-ring/40 flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                bgMode === mode
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        <div className="bg-card border-border rounded-xl border p-4">
          <ColorPicker label={t('select_color')} color={bgSolidColor} onChange={setBgSolidColor} />
        </div>
      </div>
    )
  }
)

BackgroundSettings.displayName = 'BackgroundSettings'
export default BackgroundSettings
