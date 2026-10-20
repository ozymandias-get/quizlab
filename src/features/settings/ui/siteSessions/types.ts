import type { SiteSessionView } from '@shared-core/types/siteSession'

/**
 * The translation function the site-session components take.
 *
 * The card interpolates one value (the time of the last import), so the
 * signature carries the parameters i18next's `t` accepts.
 */
export type SiteSessionTranslate = (key: string, params?: Record<string, string>) => string

export interface SiteSessionCardProps {
  /** The row the main process sent for one site. */
  view: SiteSessionView
  /** True while a switch or a clear is being written. */
  disabled: boolean
  /** Called with the site id when the user flips the switch. */
  onToggle: (siteId: string) => void
  t: SiteSessionTranslate
}

export interface SiteSessionListProps {
  /** The rows in the order the service returned them. */
  views: SiteSessionView[]
  disabled: boolean
  onToggle: (siteId: string) => void
  t: SiteSessionTranslate
}
