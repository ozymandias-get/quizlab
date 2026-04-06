import { Button } from '@ui/components/button'
import { getAiIcon } from '@ui/components/Icons'

interface PdfPlaceholderActionsProps {
  t: (key: string) => string
  onSelectPdf: () => void
  onOpenGoogleDrive?: () => void
}

function PdfPlaceholderActions({ t, onSelectPdf, onOpenGoogleDrive }: PdfPlaceholderActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <Button
        type="button"
        onClick={onSelectPdf}
        className="group relative flex items-center gap-3 overflow-hidden rounded-full border border-white/10 bg-gradient-to-b from-amber-400/10 to-orange-700/5 px-8 py-3.5 font-medium tracking-wide text-amber-50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_24px_rgba(0,0,0,0.4),0_12px_48px_rgba(245,158,11,0.2)] backdrop-blur-2xl backdrop-saturate-200 transition-all duration-300 ease-out hover:border-amber-400/40 hover:bg-amber-500/5 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_12px_32px_rgba(0,0,0,0.6),0_16px_56px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 before:absolute before:inset-0 before:z-0 before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700 before:ease-in-out"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
        >
          <path
            d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 8L12 3L7 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 3V15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="relative z-10">{t('select_pdf')}</span>
      </Button>

      {onOpenGoogleDrive && (
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenGoogleDrive}
          className="group relative flex items-center gap-3 overflow-hidden rounded-full border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent px-8 py-3.5 font-medium tracking-wide text-stone-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-2xl backdrop-saturate-200 transition-all duration-300 ease-out hover:border-white/20 hover:bg-white/5 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_12px_32px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 before:absolute before:inset-0 before:z-0 before:bg-gradient-to-r before:from-transparent before:via-white/[0.05] before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700 before:ease-in-out"
        >
          <span className="relative z-10 flex items-center [&>svg]:h-5 [&>svg]:w-5 text-[#1a73e8]">
            {getAiIcon('gdrive')}
          </span>
          <span className="relative z-10">{t('open_google_drive')}</span>
        </Button>
      )}
    </div>
  )
}

export default PdfPlaceholderActions
