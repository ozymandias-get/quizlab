import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDate } from './chatUtils'

const DateSeparator = memo(function DateSeparator({ ts }: { ts: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex justify-center py-2">
      <span className="text-ql-10 text-muted-foreground rounded-full bg-zinc-950/80 px-2.5 py-0.5 font-medium">
        {formatDate(ts, t('api_chat_today'), t('api_chat_yesterday'))}
      </span>
    </div>
  )
})

export default DateSeparator
