import { useLanguageStrings } from '@app/providers'
import { formatDate } from './utils'

export function DateSeparator({ ts }: { ts: number }) {
  const { t } = useLanguageStrings()
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-white/6" />
      <span className="shrink-0 text-ql-11 text-white/25 font-medium tracking-wide">
        {formatDate(ts, t('api_chat_today') || 'Today', t('api_chat_yesterday') || 'Yesterday')}
      </span>
      <div className="flex-1 border-t border-white/6" />
    </div>
  )
}
