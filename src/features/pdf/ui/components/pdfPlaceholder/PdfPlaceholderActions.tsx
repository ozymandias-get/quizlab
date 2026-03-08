import { Button } from '@ui/components/button'
import { getAiIcon } from '@ui/components/Icons'

interface PdfPlaceholderActionsProps {
    t: (key: string) => string
    onSelectPdf: () => void
    onOpenGoogleDrive?: () => void
}

function PdfPlaceholderActions({
    t,
    onSelectPdf,
    onOpenGoogleDrive
}: PdfPlaceholderActionsProps) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
                type="button"
                onClick={onSelectPdf}
                className="flex items-center gap-3 px-7 py-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-stone-950 font-semibold hover:from-amber-400 hover:to-orange-400 shadow-[0_8px_28px_rgba(245,158,11,0.35)]"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{t('select_pdf')}</span>
            </Button>

            {onOpenGoogleDrive && (
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onOpenGoogleDrive}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 font-semibold text-stone-100 hover:bg-white/10"
                >
                    <span className="flex items-center [&>svg]:h-5 [&>svg]:w-5 text-[#1a73e8]">
                        {getAiIcon('gdrive')}
                    </span>
                    <span>{t('open_google_drive')}</span>
                </Button>
            )}
        </div>
    )
}

export default PdfPlaceholderActions
