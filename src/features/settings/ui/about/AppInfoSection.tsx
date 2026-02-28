import { memo } from 'react'
import { motion } from 'framer-motion'

interface AppInfoSectionProps {
    t: (key: string) => string;
    appVersion: string;
}

const AppInfoSection = memo(({ t, appVersion }: AppInfoSectionProps) => {
    return (
        <header className="relative flex flex-col items-center p-10 rounded-[32px] bg-white/[0.02] border border-white/[0.05] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

            {/* App Icon with soft glow */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative mb-6"
            >
                <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full" />
                <img
                    src="/icon.png"
                    alt="Quizlab Reader"
                    className="relative w-24 h-24 rounded-3xl shadow-2xl border border-white/10"
                />
            </motion.div>

            <div className="text-center relative z-10 space-y-3">
                <h3 className="text-3xl font-black text-white tracking-tight">
                    {t('app_name')}
                </h3>
                <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{t('version')}</span>
                    <span className="text-[11px] font-mono font-bold text-white px-3 py-1 rounded-lg bg-white/10 border border-white/20 shadow-lg">
                        {appVersion}
                    </span>
                </div>
            </div>
        </header>
    )
})

AppInfoSection.displayName = 'AppInfoSection'
export default AppInfoSection
