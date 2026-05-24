import { useLanguageStrings } from '@app/providers'

interface DragOverlayProps {
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

export function DragOverlay({ onDragLeave, onDrop }: DragOverlayProps) {
  const { t } = useLanguageStrings()

  return (
    <div
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
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md animate-fade-in border-2 border-dashed border-amber-500/40 m-4 rounded-2xl animate-app-enter"
    >
      <div className="flex flex-col items-center justify-center p-8 text-center pointer-events-none scale-95 animate-pulse">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/25 mb-4 shadow-lg shadow-amber-500/5">
          <svg
            className="h-8 w-8 text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white/90 mb-1">
          {t('api_chat_upload_image') || 'Görseli Yükle'}
        </h3>
        <p className="text-ql-12 text-white/40 max-w-xs">
          {t('api_chat_drop_image_hint') ||
            'Görseli bu sohbete eklemek için herhangi bir yere bırakın.'}
        </p>
      </div>
    </div>
  )
}
