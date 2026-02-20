import { memo } from 'react'
import { motion } from 'framer-motion'
import { SelectionIcon } from '@src/components/ui/Icons'
import ColorPicker from '../ColorPicker'

interface SelectionColorSettingsProps {
    selectionColor: string;
    setSelectionColor: (val: string) => void;
    t: (key: string) => string;
}

const SelectionColorSettings = memo(({ selectionColor, setSelectionColor, t }: SelectionColorSettingsProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="p-5 rounded-[20px] bg-white/[0.02] border border-white/[0.05] space-y-5"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/[0.04] text-white/30 border border-white/[0.06]">
                    <SelectionIcon className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white/90">{t('selection_color_settings')}</h3>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">{t('selection_color_desc')}</p>
                </div>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                <ColorPicker
                    label={t('select_color')}
                    color={selectionColor}
                    onChange={setSelectionColor}
                />
                <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <div
                        className="w-10 h-6 rounded-md shadow-lg"
                        style={{ backgroundColor: selectionColor }}
                    />
                    <span className="text-[10px] text-white/40 font-medium">
                        {t('selection_color_preview_hint')}
                    </span>
                </div>
            </div>
        </motion.div>
    )
})

SelectionColorSettings.displayName = 'SelectionColorSettings'
export default SelectionColorSettings
