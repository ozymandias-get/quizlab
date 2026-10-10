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
 * Matches the section surface used by the AI home screen and the PDF
 * placeholder: translucent card, neutral icon chip, hairline-free but with a
 * consistent header rhythm.
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
      className={`border-border/60 bg-card/30 flex flex-col gap-4 rounded-2xl border p-5 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        {icon && (
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
          >
            {icon}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-ql-13 text-foreground truncate font-semibold">{title}</h3>
          {detail && <p className="text-ql-12 text-muted-foreground mt-0.5">{detail}</p>}
        </div>

        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>

      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

export default memo(SettingsSection)
