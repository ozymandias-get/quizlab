import { memo, type ReactNode } from 'react'

interface SettingsSectionProps {
  children: ReactNode
  detail?: string
  icon?: ReactNode
  title: string
  action?: ReactNode
  className?: string
}

/**
 * Canonical titled section card for a settings tab. Replaces the per-tab
 * hand-rolled "icon + title + detail inside a bordered card" blocks.
 *
 * Lives in shared primitives rather than the settings feature so settings
 * tabs can share one surface without duplicating the recipe.
 *
 * Surface: same near-black card as `AiHomeSection` (zinc-950/70 + 7% hairline)
 * and the same 16px padding rhythm, so the modal reads as a sibling of the AI
 * workspace instead of a separate module. Controls inside the card are the
 * raised level (see `SettingsRow`); the card itself stays flat.
 */
function SettingsSection({
  children,
  detail,
  icon,
  title,
  action,
  className = ''
}: SettingsSectionProps) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-zinc-950/70 p-4 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        {icon && (
          <span
            aria-hidden
            className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]"
          >
            {icon}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-ql-13 text-foreground truncate font-semibold" title={title}>
            {title}
          </h3>
          {detail && (
            <p className="text-ql-12 text-muted-foreground mt-0.5 line-clamp-2">{detail}</p>
          )}
        </div>

        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>

      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

export default memo(SettingsSection)
