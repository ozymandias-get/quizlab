import SiteSessionCard from './SiteSessionCard'
import type { SiteSessionListProps } from './types'

/**
 * The sites the app knows about, one card each.
 *
 * The order is the one the service returned — the Google group first, then
 * the registry order, then the user's own sites — because the service owns
 * that order and the list must not sort it again.
 */
function SiteSessionList({ views, disabled, onToggle, t }: SiteSessionListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {views.map((view) => (
        <SiteSessionCard
          key={view.siteId}
          view={view}
          disabled={disabled}
          onToggle={onToggle}
          t={t}
        />
      ))}
    </div>
  )
}

export default SiteSessionList
