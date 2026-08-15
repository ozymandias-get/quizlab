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
      className="z-overlay animate-fade-in border-primary/50 bg-background/95 absolute inset-0 m-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-sm"
    >
      <div className="pointer-events-none flex flex-col items-center justify-center p-8 text-center">
        <div className="border-primary/20 bg-primary/10 text-primary mb-4 flex h-14 w-14 items-center justify-center rounded-xl border shadow-xs">
          <ImagePlus className="h-7 w-7" />
        </div>
        <h3 className="text-foreground mb-1 text-base font-semibold">
          {t('api_chat_upload_image')}
        </h3>
        <p className="text-ql-12 text-muted-foreground max-w-xs">{t('api_chat_drop_image_hint')}</p>
      </div>
    </div>
  )
})

export default DragOverlay
