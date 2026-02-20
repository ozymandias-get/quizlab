import { memo } from 'react'
import { APP_CONSTANTS } from '@src/constants/appConstants'
import { GithubIcon, ChevronRightIcon } from '@src/components/ui/Icons'

interface RepositoryLinkProps {
    t: (key: string) => string;
}

const RepositoryLink = memo(({ t }: RepositoryLinkProps) => {
    return (
        <a
            href={APP_CONSTANTS.GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.12] hover:bg-white/[0.08] transition-all duration-300 shadow-sm"
        >
            <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-white/[0.08] text-white/60 border border-white/[.15] group-hover:scale-110 group-hover:bg-white/[0.15] group-hover:text-white transition-all shadow-md">
                    <GithubIcon className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                    <span className="text-sm font-bold text-white group-hover:text-white transition-colors">{t('github_repository')}</span>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest leading-none font-bold italic">{t('view_source_code')}</p>
                </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-white/20 group-hover:text-white transition-colors transform group-hover:translate-x-1" />
        </a>
    )
})

RepositoryLink.displayName = 'RepositoryLink'
export default RepositoryLink
