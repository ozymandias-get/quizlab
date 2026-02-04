import { memo } from 'react'
import { useLanguage } from '../../context/LanguageContext'

interface PdfPlaceholderProps {
    onSelectPdf: () => void;
}

/**
 * PDF yüklü olmadığında gösterilen placeholder bileşeni
 */
function PdfPlaceholder({ onSelectPdf }: PdfPlaceholderProps) {
    const { t } = useLanguage()

    return (
        <div className="h-full flex flex-col items-center justify-center gap-6 p-10 text-center bg-transparent animate-in fade-in zoom-in duration-700">
            <div className="w-28 h-28 rounded-3xl bg-white/5 backdrop-blur-xl border-2 border-dashed border-white/10 flex items-center justify-center text-stone-500 transition-all duration-300 hover:border-amber-500/50 hover:text-amber-500/70 hover:bg-white/10 hover:shadow-2xl hover:shadow-amber-500/10">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                        strokeLinejoin="round" />
                    <path d="M9 13H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M9 17H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </div>

            <div className="space-y-3">
                <h2 className="font-display text-2xl font-semibold text-stone-200">{t('no_pdf_loaded')}</h2>
                <p className="text-stone-500 text-sm max-w-[200px]">{t('drop_pdf_here')}</p>
            </div>

            <button
                className="btn-primary flex items-center gap-3"
                onClick={onSelectPdf}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        strokeLinejoin="round" />
                    <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{t('select_pdf')}</span>
            </button>
        </div>
    )
}

export default memo(PdfPlaceholder)
