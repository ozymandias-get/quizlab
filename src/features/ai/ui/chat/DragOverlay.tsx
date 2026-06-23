import { ImagePlus } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface DragOverlayProps {
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

const DragOverlay = memo(function DragOverlay({ onDragLeave, onDrop }: DragOverlayProps) {
  const { t } = useTranslation()

  return (
    <div
      role="presentation"
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragLeave(e)
      }}
      onDrop={onDrop}
      className="z-overlay animate-fade-in animate-app-enter absolute inset-0 m-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/40 bg-zinc-950/95"
    >
      <div className="pointer-events-none flex scale-95 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 shadow-lg ring-1 shadow-amber-500/5 ring-amber-500/25">
          <ImagePlus className="h-8 w-8 text-amber-400" />
        </div>
        <h3 className="mb-1 text-lg font-semibold text-white/90">{t('api_chat_upload_image')}</h3>
        <p className="text-ql-12 max-w-xs text-white/40">{t('api_chat_drop_image_hint')}</p>
      </div>
    </div>
  )
})

export default DragOverlay
