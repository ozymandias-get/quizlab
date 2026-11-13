import { AnimatedShinyText } from '@app/components/ui/animated-shiny-text'
import { Badge } from '@app/components/ui/badge'
import { BlurFade } from '@app/components/ui/blur-fade'
import { MagicCard } from '@app/components/ui/magic-card'
import { AiIcon } from '@ui/components/icons/AiIcon'

import { AlertTriangle, Box, Code, Info, PenTool } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface ChatWelcomeProps {
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
const ICONS = [Info, Code, PenTool, Box]

const ChatWelcome = memo(function ChatWelcome({
  hasProvider,
  activeProviderName,
  activeModelName,
  onSuggestionClick
}: ChatWelcomeProps) {
  const { t } = useTranslation()

  const suggestions = useMemo(
    () =>
      PROMPT_KEYS.map((key, i) => ({
        title: t(`${key}_title`),
        desc: t(`${key}_desc`),
        prompt: t(`${key}_prompt`),
        Icon: ICONS[i]
      })),
    [t]
  )

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto bg-zinc-950/40 px-6 py-8 select-none">
      <div className="relative m-auto flex w-full max-w-3xl flex-col items-center text-center">
        {/* Status Badge — shimmering provider/model label sets the SaaS tone
            without turning the whole heading into an animation. */}
        {hasProvider && (
          <div className="mb-4">
            <Badge
              variant="outline"
              className="max-w-full min-w-0 gap-2 border-white/[0.07] bg-white/[0.03] px-3 py-1 shadow-none"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <AnimatedShinyText
                shimmerWidth={120}
                className="text-ql-11 text-foreground/90 mx-0 max-w-none truncate font-semibold"
              >
                {activeProviderName}
                {activeModelName && (
                  <span className="font-normal opacity-70"> · {activeModelName}</span>
                )}
              </AnimatedShinyText>
            </Badge>
          </div>
        )}

        {/* Main Logo/Icon */}
        <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-zinc-950/80 shadow-[0_0_32px_-8px_rgba(255,255,255,0.15)]">
          <AiIcon modelKey="api-chat" className="h-7 w-7" />
        </div>

        <h2 className="text-ql-20 text-foreground tracking-ql-tight mb-1.5 font-semibold">
          {t('api_chat_welcome_title')}
        </h2>

        <p className="text-ql-13 text-muted-foreground mb-6 max-w-md leading-relaxed">
          {t('api_chat_empty_state')}
        </p>

        {/* Suggestions — compact command cards. They keep the empty state airy
            while every prompt remains visible and one click away. */}
        {hasProvider && onSuggestionClick && (
          <div className="grid w-full max-w-2xl grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
            {suggestions.map((s, i) => (
              <BlurFade
                // Static suggestions list — items never reorder
                // eslint-disable-next-line react/no-array-index-key -- Static suggestion cards, stable order
                key={i}
                delay={i * 0.05}
                className="h-full"
              >
                <MagicCard
                  className="h-full rounded-xl border-white/[0.07]"
                  gradientColor="#18181b"
                  gradientOpacity={0.35}
                  gradientFrom="#27272a"
                  gradientTo="#18181b"
                >
                  <button
                    type="button"
                    onClick={() => onSuggestionClick(s.prompt)}
                    title={s.desc}
                    className="group focus-visible:ring-ring/70 motion-normal flex h-full w-full cursor-pointer items-start gap-2.5 rounded-xl border border-transparent bg-transparent p-3.5 text-left transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="text-muted-foreground group-hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] transition-colors">
                      {s.Icon && <s.Icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-ql-12 text-foreground block font-semibold">
                        {s.title}
                      </span>
                      <span className="text-ql-11 text-muted-foreground mt-0.5 block leading-snug">
                        {s.desc}
                      </span>
                    </span>
                  </button>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        )}

        {!hasProvider && (
          <div className="mt-4 flex max-w-sm items-center gap-2.5 rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3.5 text-left">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-ql-12 text-muted-foreground leading-normal">
              {t('api_chat_no_provider')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

ChatWelcome.displayName = 'ChatWelcome'

export default ChatWelcome
