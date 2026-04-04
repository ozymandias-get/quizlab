import { useState, useMemo, useCallback, memo, type MouseEvent } from 'react'
import { useLanguage } from '@app/providers'
import { useAiActions, useAiState } from '@app/providers/AiContext'
import { GridIcon } from '@ui/components/Icons'
import { useDeleteCustomAi } from '@platform/electron/api/useAiApi'
import { AddAiModelForm } from './models/AddAiModelForm'
import { AiModelList } from './models/AiModelList'
import SettingsCollectionTabShell from './shared/SettingsCollectionTabShell'

const ModelsTab = memo(() => {
  const { enabledModels, aiSites, defaultAiModel } = useAiState()
  const { setEnabledModels, setDefaultAiModel } = useAiActions()
  const { t } = useLanguage()
  const { mutateAsync: deleteCustomAi, isPending: isDeleting } = useDeleteCustomAi()
  const [showAddForm, setShowAddForm] = useState(false)
  const MIN_ENABLED_MODELS = 1

  const toggleModel = useCallback(
    (key: string) => {
      let newModels: string[]

      if (enabledModels.includes(key)) {
        if (enabledModels.length <= MIN_ENABLED_MODELS) return
        newModels = enabledModels.filter((model) => model !== key)
        if (defaultAiModel === key && newModels.length > 0) {
          setDefaultAiModel(newModels[0])
        }
      } else {
        newModels = [...enabledModels, key]
      }

      setEnabledModels(newModels)
    },
    [enabledModels, setEnabledModels, defaultAiModel, setDefaultAiModel]
  )

  const modelsList = useMemo(
    () =>
      Object.values(aiSites)
        .filter(
          (site) =>
            !site.isSite && !['gemini', 'notebooklm', 'aistudio', 'youtube'].includes(site.id)
        )
        .map((site) => site.id),
    [aiSites]
  )

  const enabledModelsCount = useMemo(
    () => enabledModels.filter((id) => aiSites[id] && !aiSites[id].isSite).length,
    [enabledModels, aiSites]
  )

  const handleDeleteAi = useCallback(
    async (e: MouseEvent, id: string, name: string) => {
      e.stopPropagation()
      if (!confirm(t('confirm_delete', { name }))) return

      try {
        await deleteCustomAi(id)

        if (enabledModels.includes(id)) {
          const newModels = enabledModels.filter((model) => model !== id)
          setEnabledModels(newModels)
          if (defaultAiModel === id && newModels.length > 0) {
            setDefaultAiModel(newModels[0])
          }
        }
      } catch {}
    },
    [t, enabledModels, setEnabledModels, deleteCustomAi, defaultAiModel, setDefaultAiModel]
  )

  const handleAddSuccess = useCallback(
    (id: string) => {
      if (id && !enabledModels.includes(id)) {
        setEnabledModels([...enabledModels, id])
      }
    },
    [enabledModels, setEnabledModels]
  )

  return (
    <SettingsCollectionTabShell
      icon={
        <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-2.5 text-blue-400">
          <GridIcon className="w-5 h-5" />
        </div>
      }
      eyebrow={t('ai_settings')}
      title={t('ai_models')}
      showAddForm={showAddForm}
      addLabel={t('add_custom_ai')}
      cancelLabel={t('cancel')}
      description={t('models_description')}
      onToggleAddForm={() => setShowAddForm((current) => !current)}
      addForm={
        <AddAiModelForm
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          onSuccess={handleAddSuccess}
          t={t}
          isSite={false}
        />
      }
      list={
        <AiModelList
          modelsList={modelsList}
          enabledModels={enabledModels}
          aiSites={aiSites}
          toggleModel={toggleModel}
          handleDeleteAi={handleDeleteAi}
          isDeleting={isDeleting}
          minEnabledModels={MIN_ENABLED_MODELS}
          defaultAiModel={defaultAiModel}
          setDefaultAiModel={setDefaultAiModel}
          t={t}
        />
      }
      footer={
        <div className="border-t border-white/[0.04] px-1 pt-4">
          <p className="text-[10px] uppercase tracking-widest text-white/20">
            {t('active_models')}: {enabledModelsCount} / {modelsList.length} {t('models_count')}
          </p>
        </div>
      }
    />
  )
})

ModelsTab.displayName = 'ModelsTab'

export default ModelsTab
