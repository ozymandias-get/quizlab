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
      className="group shadow-xs"
      bodyClassName="space-y-0.5"
      titleClassName="transition-colors group-hover:text-primary"
      descriptionClassName="text-ql-11 font-medium text-muted-foreground"
      leading={
        <div className="border-border bg-muted text-foreground group-hover:bg-muted/80 rounded-lg border p-2 shadow-xs transition-colors">
          <GithubIcon className="h-5 w-5" />
        </div>
      }
      trailing={
        <ChevronRightIcon className="text-muted-foreground group-hover:text-foreground h-4 w-4 transform transition-colors group-hover:translate-x-0.5" />
      }
    />
  )
})

RepositoryLink.displayName = 'RepositoryLink'
export default RepositoryLink
