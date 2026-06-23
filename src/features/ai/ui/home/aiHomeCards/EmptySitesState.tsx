import { Globe } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export const EmptySitesState = memo(function EmptySitesState() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="bg-muted text-muted-foreground/50 mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
        <Globe className="h-5 w-5" />
      </div>
      <p className="text-ql-13 text-muted-foreground/70 font-medium">
        {t('ai_home.empty_sites_description')}
      </p>
      <p className="text-ql-11 text-muted-foreground/60 mt-1">{t('ai_home.empty_sites_hint')}</p>
    </div>
  )
})
