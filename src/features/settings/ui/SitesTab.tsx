import { useState, useMemo, useCallback, memo, type MouseEvent } from 'react'
import { useLanguageStrings } from '@app/providers'
import { useAiModelsCatalog, useAiCoreWorkspaceActions } from '@app/providers/AiContext'
import { GridIcon } from '@ui/components/Icons'
import { useDeleteCustomAi } from '@platform/electron/api/useAiApi'
import { Logger } from '@shared/lib/logger'
import { AddAiModelForm } from './models/AddAiModelForm'
import { AiModelList } from './models/AiModelList'
import SettingsCollectionTabShell from './shared/SettingsCollectionTabShell'
import { isCustomSitePlatform } from './shared/aiPlatformFilters'

const SitesTab = memo(() => {
  const { enabledModels: enabledSites, aiSites } = useAiModelsCatalog()
  const { setEnabledModels: setEnabledSites } = useAiCoreWorkspaceActions()
  const { t } = useLanguageStrings()
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
      }
    },
    [t, enabledSites, setEnabledSites, deleteCustomAi]
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
      icon={
        <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-2.5 text-blue-400">
          <GridIcon className="w-5 h-5" />
        </div>
      }
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
          isSite={true}
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
        <div className="flex border-t border-white/10 p-4">
          <p className="flex w-1/2 items-center justify-center gap-2 text-sm text-white/50">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {t('active_sites')}: {enabledSitesCount} / {sitesList.length} {t('sites_count')}
          </p>
          <div className="mx-2 w-px bg-white/10" />
          <p className="flex w-1/2 items-center justify-center gap-2 text-sm text-white/50">
            <GridIcon className="w-4 h-4" />
            {t('total')}: {sitesList.length} {t('sites_count')}
          </p>
        </div>
      }
    />
  )
})

SitesTab.displayName = 'SitesTab'

export default SitesTab
