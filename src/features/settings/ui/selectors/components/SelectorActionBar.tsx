import { LoaderIcon, RefreshIcon, TrashIcon } from '@ui/components/Icons'

import { memo } from 'react'

import type { SelectorEntry, TranslateFn, ValidationState } from '../types'

interface SelectorActionBarProps {
  hasSelectors: boolean
  canTestOnCurrentTab: boolean
  isTesting: boolean
  validation: ValidationState
  selectorEntry: SelectorEntry | null
  isDeleting: boolean
  onTestSelectors: () => void
  onDeleteSelectors: (hostname: string) => void
  t: TranslateFn
}

const SelectorActionBar = memo(function SelectorActionBar({
  hasSelectors,
  canTestOnCurrentTab,
  isTesting,
  validation,
  selectorEntry,
  isDeleting,
  onTestSelectors,
  onDeleteSelectors,
  t
}: SelectorActionBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={
          !hasSelectors || !canTestOnCurrentTab || isTesting || validation.status === 'loading'
        }
        onClick={onTestSelectors}
        className="ring-offset-background flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-200 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
      >
        {validation.status === 'loading' ? (
          <LoaderIcon className="h-3.5 w-3.5" />
        ) : (
          <RefreshIcon className="h-3.5 w-3.5" />
        )}
        <span className="text-ql-11 font-semibold">{t('selectors_test_current_tab')}</span>
      </button>

      {selectorEntry && (
        <button
          type="button"
          onClick={() => onDeleteSelectors(selectorEntry.hostname)}
          disabled={isDeleting}
          title={t('delete_selectors')}
          aria-label={t('delete_selectors')}
          className="ring-offset-background flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-300 transition-colors hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-200 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          <span className="text-ql-11 font-semibold">{t('reset')}</span>
        </button>
      )}
    </div>
  )
})

SelectorActionBar.displayName = 'SelectorActionBar'

export default SelectorActionBar
