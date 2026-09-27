import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { ChevronRightIcon, GithubIcon } from '@ui/components/Icons'

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
      className="group"
      leading={
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
        >
          <GithubIcon className="h-4 w-4" />
        </span>
      }
      trailing={
        <ChevronRightIcon className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0 transition-colors" />
      }
    />
  )
})

RepositoryLink.displayName = 'RepositoryLink'
export default RepositoryLink
