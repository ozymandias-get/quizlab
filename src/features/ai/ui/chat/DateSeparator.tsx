import { Separator } from '@app/components/ui/separator'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDate } from './utils'

export const DateSeparator = memo(function DateSeparator({ ts }: { ts: number }) {
  const { t } = useTranslation()
  return (
    <div className="my-4 flex items-center gap-3">
      <Separator className="flex-1 opacity-20" />
      <span className="text-ql-11 shrink-0 font-medium tracking-wide text-white/25">
        {formatDate(ts, t('api_chat_today'), t('api_chat_yesterday'))}
      </span>
      <Separator className="flex-1 opacity-20" />
    </div>
  )
})
