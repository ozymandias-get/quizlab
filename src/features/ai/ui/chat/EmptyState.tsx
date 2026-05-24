import { useLanguageStrings } from '@app/providers'
import { AiIcon } from '@ui/components/icons/AiIcon'

interface EmptyStateProps {
  hasProvider: boolean
  activeProviderName: string
  activeModelName: string
  onSuggestionClick?: (text: string) => void
}

export function EmptyState({
  hasProvider,
  activeProviderName,
  activeModelName,
  onSuggestionClick
}: EmptyStateProps) {
  const { t } = useLanguageStrings()

  const suggestions = [
    {
      title: t('api_chat_sugg_1_title') || 'Bilgi Edin',
      desc: t('api_chat_sugg_1_desc') || 'Kardiyoloji tıp sınavı için çalışma planı hazırla...',
      prompt:
        'Kardiyoloji tıp sınavı için 4 haftalık yoğunlaştırılmış, önemli konuları kapsayan bir çalışma planı hazırlar mısın?',
      icon: (
        <svg
          className="h-4 w-4 text-blue-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      )
    },
    {
      title: t('api_chat_sugg_2_title') || 'Kod Analizi',
      desc: t('api_chat_sugg_2_desc') || 'Bu JavaScript kodundaki bellek sızıntısını bul...',
      prompt:
        'Aşağıdaki JavaScript kodunda olası bellek sızıntılarını (memory leaks) analiz edip çözüm önerir misin?\n\n```javascript\nfunction setupHandler() {\n  const largeData = new Array(1000000).fill("data");\n  document.getElementById("btn").addEventListener("click", () => {\n    console.log("Clicked!", largeData.length);\n  });\n}\n```',
      icon: (
        <svg
          className="h-4 w-4 text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )
    },
    {
      title: t('api_chat_sugg_3_title') || 'Metin Akademikleştir',
      desc: t('api_chat_sugg_3_desc') || 'Paragrafı akademik bir dille yeniden yaz...',
      prompt:
        'Aşağıdaki gayriresmi paragrafı akademik standartlara uygun, profesyonel ve literatüre yakışır bir dille yeniden kaleme alabilir misin?\n\n"Bizce bu uygulama bayağı iyi çalışıyor çünkü verileri aşırı hızlı çekiyor ve arayüzü de gayet basit tasarlanmış."',
      icon: (
        <svg
          className="h-4 w-4 text-purple-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      )
    },
    {
      title: t('api_chat_sugg_4_title') || 'Yaratıcı Yazım',
      desc: t('api_chat_sugg_4_desc') || 'Quizlab için eğlenceli tanıtım yazısı yaz...',
      prompt:
        'Quizlab Reader uygulamasının yapay zeka özellikleri içeren, tıp ve hukuk öğrencilerini cezbedecek enerjik, eğlenceli ve ilgi çekici bir sosyal medya tanıtım yazısı yazar mısın?',
      icon: (
        <svg
          className="h-4 w-4 text-pink-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
    }
  ]

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 bg-black/35 relative overflow-hidden select-none">
      {/* Decorative Halo background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/[0.03] rounded-full blur-[140px] pointer-events-none" />
      </div>

      <div className="relative flex flex-col items-center max-w-2xl w-full text-center">
        {/* Status Badge */}
        {hasProvider && (
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/15 bg-amber-500/5 px-3 py-1 text-ql-11 text-amber-400/80 font-mono shadow-sm animate-app-enter">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            {activeProviderName}
            {activeModelName && <span className="opacity-60"> · {activeModelName}</span>}
          </div>
        )}

        {/* Animated Main Logo/Icon */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-600/5 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/15 animate-app-enter transition-transform duration-300 hover:scale-105">
          <AiIcon modelKey="api-chat" className="h-8 w-8 text-amber-500" />
        </div>

        <h2 className="text-ql-20 font-bold text-white/95 mb-2.5 tracking-tight">
          {t('api_chat_welcome_title') || "Quizlab API Chat'e Hoş Geldiniz"}
        </h2>

        <p className="text-ql-13 text-white/40 mb-10 max-w-md leading-relaxed">
          {t('api_chat_empty_state') ||
            'Kendi API anahtarınızla favori yapay zeka modelinizi bağlayın ve sınırsızca sohbet edin.'}
        </p>

        {/* Suggestions Grid */}
        {hasProvider && onSuggestionClick && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left animate-app-enter">
            {suggestions.map((s, i) => (
              <div
                key={i}
                onClick={() => onSuggestionClick(s.prompt)}
                className="group relative flex flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/[0.03] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_0_0_1px_rgba(245,158,11,0.03)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1 rounded-lg bg-white/[0.03] group-hover:bg-amber-500/10 transition-colors">
                    {s.icon}
                  </div>
                  <span className="text-ql-12 font-semibold text-white/80 group-hover:text-white transition-colors">
                    {s.title}
                  </span>
                </div>
                <p className="text-ql-11 text-white/35 leading-normal group-hover:text-white/50 transition-colors">
                  {s.desc}
                </p>
                {/* Micro-arrow */}
                <svg
                  className="absolute right-3.5 bottom-3.5 h-3 w-3 text-white/10 opacity-0 group-hover:opacity-100 group-hover:text-amber-500/80 -translate-x-1 group-hover:translate-x-0 transition-all duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            ))}
          </div>
        )}

        {!hasProvider && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 max-w-sm animate-pulse shadow-sm">
            <svg
              className="h-4 w-4 text-amber-400 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="text-ql-12 text-amber-400/85 text-left font-medium leading-normal">
              {t('api_chat_no_provider') ||
                'Ayarlar → API Sohbet bölümünden bir sağlayıcı yapılandırın.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
