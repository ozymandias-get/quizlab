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
      className="group shadow-sm hover:bg-white/[0.08]"
      bodyClassName="space-y-0.5"
      titleClassName="transition-colors group-hover:text-white"
      descriptionClassName="text-ql-10 font-medium tracking-ql-fine leading-none italic text-white/40"
      leading={
        <div className="rounded-xl border border-white/[.15] bg-white/[0.08] p-2.5 text-white/60 shadow-md transition-colors group-hover:scale-110 group-hover:bg-white/[0.15] group-hover:text-white">
          <GithubIcon className="h-6 w-6" />
        </div>
      }
      trailing={
        <ChevronRightIcon className="h-5 w-5 transform text-white/20 transition-colors group-hover:translate-x-1 group-hover:text-white" />
      }
    />
  )
})

RepositoryLink.displayName = 'RepositoryLink'
export default RepositoryLink
