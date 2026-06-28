import { useDeleteCustomAi } from '@platform/electron/api/useSettingsAiApi'

import { useToastActions } from '@app/providers'
import { useAiModelActions, useAiModelsCatalog } from '@app/providers/AiContext'
import { Logger } from '@shared/lib/logger'
import { GridIcon } from '@ui/components/Icons'

import { memo, type MouseEvent, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AddAiModelForm from './models/AddAiModelForm'
import AiModelList from './models/AiModelList'
import { isCustomSitePlatform } from './shared/aiPlatformFilters'
import SettingsCollectionTabShell from './shared/SettingsCollectionTabShell'

const SITES_ICON = (
  <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-2.5 text-blue-400">
    <GridIcon className="h-5 w-5" />
  </div>
)

const SitesTab = memo(() => {
  const { enabledModels: enabledSites, aiSites } = useAiModelsCatalog()
  const { setEnabledModels: setEnabledSites } = useAiModelActions()
  const { t } = useTranslation()
  const { showError } = useToastActions()
  const { mutateAsync: deleteCustomAi, isPending: isDeleting } = useDeleteCustomAi()
  const [showAddForm, setShowAddForm] = useState(false)
  const MIN_ENABLED_MODELS = 1

  const toggleModel = useCallback(
    (key: string) => {
      const newSites = enabledSites.includes(key)
        ? enabledSites.length <= MIN_ENABLED_MODELS
          ? enabledSites
          : enabledSites.filter((siteId) => siteId !== key)
        : [...enabledSites, key]

      setEnabledSites(newSites)
    },
    [enabledSites, setEnabledSites]
  )

  const sitesList = useMemo(
    () =>
      Object.values(aiSites)
        .filter(isCustomSitePlatform)
        .map((site) => site.id),
    [aiSites]
  )

  const enabledSitesCount = useMemo(
    () => enabledSites.filter((id) => aiSites[id] && aiSites[id].isSite).length,
    [enabledSites, aiSites]
  )

  const handleDeleteAi = useCallback(
    async (e: MouseEvent, id: string, name: string) => {
      e.stopPropagation()
      if (!confirm(t('confirm_delete', { name }))) return

      try {
        await deleteCustomAi(id)
        if (enabledSites.includes(id)) {
          setEnabledSites(enabledSites.filter((siteId) => siteId !== id))
        }
      } catch (error) {
        Logger.error('[SitesTab] deleteCustomAi failed', error)
        showError('toast_ai_config_delete_failed')
      }
    },
    [t, enabledSites, setEnabledSites, deleteCustomAi, showError]
  )

  const handleAddSuccess = useCallback(
    (id: string) => {
      if (id && !enabledSites.includes(id)) {
        setEnabledSites([...enabledSites, id])
      }
    },
    [enabledSites, setEnabledSites]
  )

  return (
    <SettingsCollectionTabShell
      icon={SITES_ICON}
      eyebrow={t('site_settings')}
      title={t('ai_sites')}
      showAddForm={showAddForm}
      addLabel={t('add_site')}
      cancelLabel={t('cancel')}
      description={t('sites_description')}
      onToggleAddForm={() => setShowAddForm((current) => !current)}
      addForm={
        <AddAiModelForm
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          onSuccess={handleAddSuccess}
          t={t}
          isSite
        />
      }
      list={
        <AiModelList
          modelsList={sitesList}
          enabledModels={enabledSites}
          aiSites={aiSites}
          toggleModel={toggleModel}
          handleDeleteAi={handleDeleteAi}
          isDeleting={isDeleting}
          minEnabledModels={MIN_ENABLED_MODELS}
          t={t}
        />
      }
      footer={
        <div className="border-t border-white/[0.04] px-1 pt-4">
          <p className="text-ql-11 tracking-wide text-white/28">
            {t('active_sites')}: {enabledSitesCount} / {sitesList.length} {t('sites_count')}
          </p>
        </div>
      }
    />
  )
})

SitesTab.displayName = 'SitesTab'

export default SitesTab
