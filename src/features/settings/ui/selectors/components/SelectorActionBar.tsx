import { Button } from '@app/components/ui/button'
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={
          !hasSelectors || !canTestOnCurrentTab || isTesting || validation.status === 'loading'
        }
        onClick={onTestSelectors}
        className="gap-2"
      >
        {validation.status === 'loading' ? (
          <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshIcon className="h-3.5 w-3.5" />
        )}
        <span className="text-ql-11 font-semibold">{t('selectors_test_current_tab')}</span>
      </Button>

      {selectorEntry && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => onDeleteSelectors(selectorEntry.hostname)}
          disabled={isDeleting}
          title={t('delete_selectors')}
          aria-label={t('delete_selectors')}
          className="gap-2"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          <span className="text-ql-11 font-semibold">{t('reset')}</span>
        </Button>
      )}
    </div>
  )
})

SelectorActionBar.displayName = 'SelectorActionBar'

export default SelectorActionBar
