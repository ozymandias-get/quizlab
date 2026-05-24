import { useLanguageStrings } from '@app/providers'

export function EmptySitesState() {
  const { t } = useLanguageStrings()

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-ql-13 text-white/45">{t('ai_home.empty_sites_description')}</p>
    </div>
  )
}
