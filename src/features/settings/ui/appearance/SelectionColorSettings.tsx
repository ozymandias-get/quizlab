import { SelectionIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { type CSSProperties, memo, useMemo } from 'react'

import ColorPicker from '../ColorPicker'

interface SelectionColorSettingsProps {
  selectionColor: string
  setSelectionColor: (val: string) => void
  t: (key: string) => string
}

const SelectionColorSettings = memo(
  ({ selectionColor, setSelectionColor, t }: SelectionColorSettingsProps) => {
    const previewStyle = useMemo<CSSProperties>(
      () => ({ backgroundColor: selectionColor }),
      [selectionColor]
    )

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.05 }}
        className="bg-card border-border space-y-5 rounded-xl border p-5"
      >
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground/60 border-border rounded-lg border p-2">
            <SelectionIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-ql-14 text-foreground font-bold">
              {t('selection_color_settings')}
            </h3>
            <p className="text-ql-11 text-foreground/75 tracking-ql-fine">
              {t('selection_color_desc')}
            </p>
          </div>
        </div>

        <div className="bg-card border-border rounded-xl border p-4">
          <ColorPicker
            label={t('select_color')}
            color={selectionColor}
            onChange={setSelectionColor}
          />
          <div className="bg-card border-border mt-3 flex items-center gap-3 rounded-lg border p-3">
            <div className="h-6 w-10 rounded-md shadow-lg" style={previewStyle} />
            <span className="text-ql-10 text-foreground/75 font-medium">
              {t('selection_color_preview_hint')}
            </span>
          </div>
        </div>
      </motion.div>
    )
  }
)

SelectionColorSettings.displayName = 'SelectionColorSettings'
export default SelectionColorSettings
