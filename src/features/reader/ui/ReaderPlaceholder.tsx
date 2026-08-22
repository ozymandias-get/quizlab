import { useOptionalComponents } from '@platform/electron/api/useOptionalComponentsApi'

import { InlineSpinner } from '@shared/ui/components/primitives'

import { FileText, Sparkles } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import DoclingInstallCta from './DoclingInstallCta'

interface Props {
  isInstalling?: boolean
  onContinuePdf: () => void
  onInstalled?: () => void
}

const ReaderPlaceholder = memo(function ReaderPlaceholder({ onContinuePdf, onInstalled }: Props) {
  const { t } = useTranslation()
  const { data: components, isLoading } = useOptionalComponents()
  const docling = components?.find((c) => c.id === 'docling')
  const isInstalled = docling?.status === 'installed'
  const isBusy = docling?.status === 'installing' || docling?.status === 'updating'

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <InlineSpinner />
        <span className="text-muted-foreground text-ql-13">Yükleniyor…</span>
      </div>
    )
  }

  if (!isInstalled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <DoclingInstallCta onContinuePdf={onContinuePdf} onInstalled={onInstalled} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl">
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-ql-14 font-semibold">
          {isBusy
            ? t('docling_installing', { defaultValue: 'Yükleniyor...' })
            : t('reader_coming_soon', { defaultValue: 'Akıllı Okuma hazırlanıyor' })}
        </h3>
        <p className="text-muted-foreground text-ql-12 max-w-sm leading-relaxed">
          {t('reader_placeholder_desc', {
            defaultValue:
              'Belge akıllı okuma görünümünde işlenecek. Bu alan bir sonraki adımda gerçek okuma görünümü ile değişecek.'
          })}
        </p>
      </div>
      {isBusy && <InlineSpinner />}
      <button
        type="button"
        onClick={onContinuePdf}
        className="text-ql-12 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
      >
        <FileText className="h-3.5 w-3.5" />
        {t('docling_continue_pdf', { defaultValue: 'Normal PDF ile Devam Et' })}
      </button>
    </div>
  )
})

export default ReaderPlaceholder
