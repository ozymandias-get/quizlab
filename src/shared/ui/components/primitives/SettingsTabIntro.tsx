import { memo, type ReactNode } from 'react'

interface SettingsTabIntroProps {
  icon: ReactNode
  description?: string
  action?: ReactNode
  hideDescription?: boolean
  /** Optional page heading. Most tabs get their name from the sidebar rail and
   *  omit this; supply it only when the panel has its own distinct title. */
  title?: string
}

function SettingsTabIntro({
  icon,
  description,
  action,
  hideDescription = false,
  title
}: SettingsTabIntroProps) {
  const hasBody = !!title || (!!description && !hideDescription)

  return (
    // Compact horizontal strip: one line of heading plus at most two lines of
    // description, and the description drops entirely in short windows so the
    // form controls stay above the fold.
    <div className="flex items-center justify-between gap-3 pb-0.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        {hasBody && (
          <div className="max-w-2xl min-w-0">
            {title && (
              <h2 className="text-ql-16 text-foreground tracking-ql-tight font-semibold">
                {title}
              </h2>
            )}
            {description && !hideDescription && (
              <p
                className={`text-ql-12 text-muted-foreground leading-relaxed [@media(max-height:700px)]:hidden ${title ? 'mt-0.5' : ''}`}
              >
                {description}
              </p>
            )}
          </div>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export default memo(SettingsTabIntro)
