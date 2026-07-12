import { Loader2 } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface LoadingContentProps {
  mode: 'install' | 'remove'
}

function LoadingContent({ mode }: LoadingContentProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-4 px-8 pt-4 pb-8">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
      <p className="text-ql-14 text-white/60">
        {mode === 'install'
          ? t('gws_extension_wizard_installing')
          : t('gws_extension_wizard_removing')}
      </p>
    </div>
  )
}

export default memo(LoadingContent)
