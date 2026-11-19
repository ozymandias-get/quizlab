import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { SettingsRowIcon } from '@shared/ui/components/primitives'
import { GithubIcon } from '@ui/components/Icons'

import { ExternalLink } from 'lucide-react'
import { memo } from 'react'

import AboutActionCard from './AboutActionCard'

interface RepositoryLinkProps {
  t: (key: string) => string
}

const RepositoryLink = memo(({ t }: RepositoryLinkProps) => {
  return (
    <AboutActionCard
      title={t('github_repository')}
      description={t('view_source_code')}
      href={APP_CONSTANTS.GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      interactive
      className="group border-white/[0.07] bg-zinc-900/45 hover:bg-white/5"
      leading={
        <SettingsRowIcon>
          <GithubIcon className="h-4 w-4" />
        </SettingsRowIcon>
      }
      trailing={
        <span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center gap-1">
          <ExternalLink className="size-3.5 transition-colors" aria-hidden />
        </span>
      }
    />
  )
})

RepositoryLink.displayName = 'RepositoryLink'
export default RepositoryLink
