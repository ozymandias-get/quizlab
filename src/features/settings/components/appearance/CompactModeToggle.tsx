import { memo } from 'react'
import { motion } from 'framer-motion'
import { Switch, Field, Label, Description } from '@headlessui/react'
import { EyeIcon } from '@src/components/ui/Icons'

interface CompactModeToggleProps {
    showOnlyIcons: boolean;
    setShowOnlyIcons: (val: boolean) => void;
    t: (key: string) => string;
}

const CompactModeToggle = memo(({ showOnlyIcons, setShowOnlyIcons, t }: CompactModeToggleProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
        >
            <Field
                className={`
                    group flex items-center justify-between p-4 rounded-[20px] transition-all duration-300 border cursor-pointer
                    ${showOnlyIcons
                        ? 'bg-white/[0.06] border-white/[0.12] shadow-lg'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                    }
                `}
                onClick={() => setShowOnlyIcons(!showOnlyIcons)}
            >
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className={`
                            p-3 rounded-2xl border transition-all duration-300
                            ${showOnlyIcons
                                ? 'bg-gradient-to-br from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400'
                                : 'bg-white/[0.02] border-white/[0.06] text-white/20'
                            }
                        `}>
                            <EyeIcon className="w-5 h-5" />
                        </div>
                        {showOnlyIcons && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a0a0a] shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                            />
                        )}
                    </div>
                    <div className="space-y-0.5">
                        <Label className="text-sm font-bold text-white cursor-pointer">{t('show_only_icons')}</Label>
                        <Description className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
                            {t('show_only_icons_desc')}
                        </Description>
                    </div>
                </div>
                <Switch
                    checked={showOnlyIcons}
                    onChange={setShowOnlyIcons}
                    className={`
                        group relative flex items-center h-6 w-11 cursor-pointer rounded-full p-1 transition-all duration-300 border
                        ${showOnlyIcons ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/[0.04] border-white/[0.08]'}
                    `}
                >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full ring-0 transition duration-300 shadow-lg ${showOnlyIcons ? 'translate-x-5 bg-emerald-500' : 'translate-x-0 bg-white/20'}`} />
                </Switch>
            </Field>
        </motion.div>
    )
})

CompactModeToggle.displayName = 'CompactModeToggle'
export default CompactModeToggle
