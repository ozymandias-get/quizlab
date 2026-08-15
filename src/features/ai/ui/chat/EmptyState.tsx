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
const EmptyState = memo(function EmptyState({
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
    <div className="bg-card/20 relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-8 select-none">
      <div className="relative flex w-full max-w-2xl flex-col items-center text-center">
        {/* Status Badge */}
        {hasProvider && (
          <div className="text-ql-11 border-border bg-muted/60 text-muted-foreground mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono shadow-xs">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-foreground font-semibold">{activeProviderName}</span>
            {activeModelName && <span className="opacity-60"> · {activeModelName}</span>}
          </div>
        )}

        {/* Main Logo/Icon */}
        <div className="border-primary/20 bg-primary/10 text-primary mb-4 flex h-14 w-14 items-center justify-center rounded-xl border shadow-xs">
          <AiIcon modelKey="api-chat" className="h-7 w-7" />
        </div>

        <h2 className="text-ql-18 text-foreground mb-2 font-semibold">
          {t('api_chat_welcome_title')}
        </h2>

        <p className="text-ql-13 text-muted-foreground mb-8 max-w-md leading-relaxed">
          {t('api_chat_empty_state')}
        </p>

        {/* Suggestions Grid */}
        {hasProvider && onSuggestionClick && (
          <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
            {suggestions.map((s, i) => (
              <div
                // Static suggestions list — items never reorder
                // eslint-disable-next-line react/no-array-index-key -- Static suggestion buttons, stable order
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
                className="group border-border bg-card hover:border-border hover:bg-muted/70 focus-visible:ring-ring/40 relative flex cursor-pointer flex-col justify-between rounded-lg border p-3 shadow-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="bg-muted text-muted-foreground group-hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors">
                    {s.Icon && <s.Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className="text-ql-12 text-foreground font-semibold">{s.title}</span>
                </div>
                <p className="text-ql-11 text-muted-foreground leading-normal">{s.desc}</p>
                <ArrowRight className="text-muted-foreground/40 absolute right-3 bottom-3 h-3 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        )}

        {!hasProvider && (
          <div className="border-border bg-card mt-4 flex max-w-sm items-center gap-2.5 rounded-lg border p-3 text-left shadow-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-ql-12 text-muted-foreground leading-normal">
              {t('api_chat_no_provider')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

export default EmptyState
