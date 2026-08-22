import { useOptionalComponents } from '@platform/electron/api/useOptionalComponentsApi'

import { Button } from '@app/components/ui/button'
import { getElectronApi } from '@shared/lib/electronApi'

import { Download, FileText } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onContinuePdf: () => void
  onInstalled?: () => void
}

const DoclingInstallCta = memo(function DoclingInstallCta({ onContinuePdf, onInstalled }: Props) {
  const { t } = useTranslation()
  const { data: components } = useOptionalComponents()
  const docling = components?.find((c) => c.id === 'docling')
  const isInstalled = docling?.status === 'installed'
  const [isInstalling, setIsInstalling] = useState(false)

  const handleDownload = useCallback(() => {
    const api = getElectronApi()
    if (!api?.optionalComponents) return
    setIsInstalling(true)
    void api.optionalComponents
      .runAction('docling', 'install')
      .then(() => {
        setIsInstalling(false)
        onInstalled?.()
      })
      .catch(() => setIsInstalling(false))
  }, [onInstalled])

  useEffect(() => {
    const api = getElectronApi()
    if (!api?.onDoclingInstallProgress) return
    const off = api.onDoclingInstallProgress((e) => {
      if (e.componentId !== 'docling') return
      if (e.phase === 'completed') {
        setIsInstalling(false)
        onInstalled?.()
      }
      if (e.phase === 'failed') setIsInstalling(false)
    })
    return off
  }, [onInstalled])

  if (isInstalled) return null

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-5 text-center shadow-xs">
      <div className="bg-primary/10 text-primary mx-auto flex h-10 w-10 items-center justify-center rounded-full">
        <Download className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-ql-13 font-semibold">
          {t('docling_cta_title', { defaultValue: 'Akıllı Okuma için ek bileşen gerekli' })}
        </h3>
        <p className="text-muted-foreground text-ql-12 leading-relaxed">
          {t('docling_cta_desc', {
            defaultValue: 'Docling motoru yerel olarak kurulacak. Belgeleriniz silinmez.'
          })}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Button
          type="button"
          size="sm"
          onClick={handleDownload}
          disabled={isInstalling}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          <span>
            {isInstalling
              ? t('docling_installing', { defaultValue: 'Yükleniyor...' })
              : t('docling_download_continue', { defaultValue: 'İndir ve Devam Et' })}
          </span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onContinuePdf}
          className="gap-1.5"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{t('docling_continue_pdf', { defaultValue: 'Normal PDF ile Devam Et' })}</span>
        </Button>
      </div>
    </div>
  )
})

export default DoclingInstallCta
