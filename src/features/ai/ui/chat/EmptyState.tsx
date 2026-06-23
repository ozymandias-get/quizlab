import { AiIcon } from '@ui/components/icons/AiIcon'

import { AlertTriangle, ArrowRight, Box, Code, Info, PenTool } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface EmptyStateProps {
  hasProvider: boolean
  activeProviderName: string
  activeModelName: string
  onSuggestionClick?: (text: string) => void
}

const PROMPT_KEYS = [
  'api_chat_sugg_1',
  'api_chat_sugg_2',
  'api_chat_sugg_3',
  'api_chat_sugg_4'
] as const
const FALLBACK_TITLES = ['Bilgi Edin', 'Kod Analizi', 'Metin Akademikleştir', 'Yaratıcı Yazım']
const FALLBACK_DESCS = [
  'Kardiyoloji tıp sınavı için çalışma planı hazırla...',
  'Bu JavaScript kodundaki bellek sızıntısını bul...',
  'Paragrafı akademik bir dille yeniden yaz...',
  'Quizlab için eğlenceli tanıtım yazısı yaz...'
]
const PROMPTS = [
  'Kardiyoloji tıp sınavı için 4 haftalık yoğunlaştırılmış, önemli konuları kapsayan bir çalışma planı hazırlar mısın?',
  'Aşağıdaki JavaScript kodunda olası bellek sızıntılarını (memory leaks) analiz edip çözüm önerir misin?\n\n```javascript\nfunction setupHandler() {\n  const largeData = new Array(1000000).fill("data");\n  document.getElementById("btn").addEventListener("click", () => {\n    console.log("Clicked!", largeData.length);\n  });\n}\n```',
  'Aşağıdaki gayriresmi paragrafı akademik standartlara uygun, profesyonel ve literatüre yakışır bir dille yeniden kaleme alabilir misin?\n\n"Bizce bu uygulama bayağı iyi çalışıyor çünkü verileri aşırı hızlı çekiyor ve arayüzü de gayet basit tasarlanmış."',
  'Quizlab Reader uygulamasının yapay zeka özellikleri içeren, tıp ve hukuk öğrencilerini cezbedecek enerjik, eğlenceli ve ilgi çekici bir sosyal medya tanıtım yazısı yazar mısın?'
]
const ICONS = [Info, Code, PenTool, Box]

// React.memo: EmptyState is a child of ApiChatPage which re-renders on every
// keystroke in the chat input (inputValue change). Wrapping in memo means
// EmptyState only re-renders when its actual props (hasProvider,
// activeProviderName, activeModelName, onSuggestionClick) change. The parent
// (ApiChatPage) re-renders the parent div tree on each keystroke, but the
// suggestions grid, status badge, and decorative elements stay stable.
export const EmptyState = memo(function EmptyState({
  hasProvider,
  activeProviderName,
  activeModelName,
  onSuggestionClick
}: EmptyStateProps) {
  const { t } = useTranslation()

  const suggestions = useMemo(
    () =>
      PROMPT_KEYS.map((key, i) => ({
        title: t(`${key}_title`) || FALLBACK_TITLES[i],
        desc: t(`${key}_desc`) || FALLBACK_DESCS[i],
        prompt: PROMPTS[i],
        Icon: ICONS[i]
      })),
    [t]
  )

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-black/35 px-6 py-8 select-none">
      {/* Decorative Halo background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.03] blur-[140px]" />
      </div>

      <div className="relative flex w-full max-w-2xl flex-col items-center text-center">
        {/* Status Badge */}
        {hasProvider && (
          <div className="text-ql-11 animate-app-enter mb-5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/15 bg-amber-500/5 px-3 py-1 font-mono text-amber-400/80 shadow-sm">
            <span className="h-1.5 w-1.5 shrink-0 -translate-y-[0.5px] rounded-full bg-emerald-500" />
            {activeProviderName}
            {activeModelName && <span className="opacity-60"> · {activeModelName}</span>}
          </div>
        )}

        {/* Animated Main Logo/Icon */}
        <div className="animate-app-enter mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-600/5 shadow-lg ring-1 shadow-amber-500/5 ring-amber-500/15 transition-transform duration-300 hover:scale-105">
          <AiIcon modelKey="api-chat" className="h-8 w-8 text-amber-500" />
        </div>

        <h2 className="text-ql-20 mb-2.5 font-bold tracking-tight text-white/95">
          {t('api_chat_welcome_title')}
        </h2>

        <p className="text-ql-13 mb-10 max-w-md leading-relaxed text-white/40">
          {t('api_chat_empty_state')}
        </p>

        {/* Suggestions Grid */}
        {hasProvider && onSuggestionClick && (
          <div className="animate-app-enter grid w-full max-w-xl grid-cols-1 gap-3 text-left sm:grid-cols-2">
            {suggestions.map((s, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => onSuggestionClick(s.prompt)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSuggestionClick(s.prompt)
                  }
                }}
                className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 transition-colors duration-200 hover:-translate-y-0.5 hover:border-amber-500/30 hover:bg-amber-500/[0.03] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_0_0_1px_rgba(245,158,11,0.03)] focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-[0.98]"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="rounded-lg bg-white/[0.03] p-1 transition-colors group-hover:bg-amber-500/10">
                    {s.Icon && <s.Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-ql-12 font-semibold text-white/80 transition-colors group-hover:text-white">
                    {s.title}
                  </span>
                </div>
                <p className="text-ql-11 leading-normal text-white/35 transition-colors group-hover:text-white/50">
                  {s.desc}
                </p>
                <ArrowRight className="absolute right-3.5 bottom-3.5 h-3 w-3 -translate-x-1 text-white/10 opacity-0 transition-[color,transform] duration-200 group-hover:translate-x-0 group-hover:text-amber-500/80 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        )}

        {!hasProvider && (
          <div className="mt-4 flex max-w-sm items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 shadow-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-ql-12 text-left leading-normal font-medium text-amber-400/85">
              {t('api_chat_no_provider')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
})
