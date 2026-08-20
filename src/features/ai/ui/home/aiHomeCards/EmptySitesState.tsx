import { EmptyState } from '@shared/ui/components/primitives'

import { Globe } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

const EmptySitesState = memo(function EmptySitesState() {
  const { t } = useTranslation()

  return (
    <EmptyState
      bare
      icon={Globe}
      title={t('ai_home.empty_sites_description')}
      description={t('ai_home.empty_sites_hint')}
      size="sm"
    />
  )
})

export default EmptySitesState
