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
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragLeave(e)
      }}
      onDrop={onDrop}
      className="z-overlay animate-fade-in bg-background/40 absolute inset-0 flex items-end justify-center p-4 backdrop-blur-xs"
    >
      {/* Drop gate sits next to the composer instead of painting the whole
          panel opaque: the conversation remains readable and the reader can
          see where the image will land. */}
      <div className="border-primary/50 bg-card/85 shadow-ambient-sm ring-primary/15 pointer-events-none mb-2 flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-3 text-center ring-2 motion-safe:animate-pulse">
        <div className="border-primary/20 bg-primary/10 text-primary mb-1.5 flex size-8 items-center justify-center rounded-lg border">
          <ImagePlus className="size-4" />
        </div>
        <h3 className="text-foreground text-ql-13 font-semibold">{t('api_chat_upload_image')}</h3>
        <p className="text-ql-11 text-muted-foreground max-w-md">{t('api_chat_drop_image_hint')}</p>
      </div>
    </div>
  )
})

export default DragOverlay
