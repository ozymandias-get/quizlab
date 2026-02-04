import { useLanguage } from '../../context'

export const SettingsLoadingSpinner = () => {
    const { t } = useLanguage()
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/80 animate-spin" />
                <span className="text-xs font-medium text-white/50 tracking-wider uppercase">{t('loading')}</span>
            </div>
        </div>
    )
}
