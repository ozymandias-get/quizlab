import { useClearAiModelData, useDeleteCustomAi } from '@platform/electron/api/useSettingsAiApi'

import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { useToastActions } from '@app/providers'
import {
  useAiContentHostActions,
  useAiModelActions,
  useAiModelsCatalog
} from '@app/providers/ai-context'
import { useConfirmDialog } from '@shared/hooks'
import { Logger } from '@shared/lib/logger'
import { SettingsSection, SettingsTabIcon } from '@shared/ui/components/primitives'
import { GridIcon } from '@ui/components/Icons'

import { memo, type MouseEvent, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AddAiModelForm from './models/AddAiModelForm'
import AiModelList from './models/AiModelList'
import { isCustomModelPlatform } from './shared/aiPlatformFilters'
import SettingsCollectionTabShell from './shared/SettingsCollectionTabShell'

const MODELS_ICON = (
  <SettingsTabIcon>
    <GridIcon className="h-5 w-5" />
  </SettingsTabIcon>
)

const ModelsTab = memo(() => {
  const { enabledModels, aiSites, defaultAiModel } = useAiModelsCatalog()
  const { setEnabledModels, setDefaultAiModel } = useAiModelActions()
  const { reloadActiveContent } = useAiContentHostActions()
  const { t } = useTranslation()
  const { showError } = useToastActions()
  const { mutateAsync: deleteCustomAi, isPending: isDeleting } = useDeleteCustomAi()
  const { mutateAsync: clearAiModelData, isPending: isClearingModelData } = useClearAiModelData()
  const [showAddForm, setShowAddForm] = useState(false)
  const MIN_ENABLED_MODELS = 1

  const { confirm, props: confirmProps } = useConfirmDialog()

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
        .filter(isCustomModelPlatform)
        .map((site) => site.id),
    [aiSites]
  )

  const enabledModelsCount = useMemo(
    () => modelsList.filter((id) => enabledModels.includes(id)).length,
    [enabledModels, modelsList]
  )

  const handleDeleteAi = useCallback(
    async (e: MouseEvent, id: string, name: string) => {
      e.stopPropagation()
      if (!(await confirm({ title: t('confirm_delete', { name }), variant: 'destructive' }))) return

      try {
        await deleteCustomAi(id)

        if (enabledModels.includes(id)) {
          const newModels = enabledModels.filter((model) => model !== id)
          setEnabledModels(newModels)
          if (defaultAiModel === id && newModels.length > 0) {
            setDefaultAiModel(newModels[0])
          }
        }
      } catch (error) {
        Logger.error('[ModelsTab] deleteCustomAi failed', error)
        showError('toast_ai_config_delete_failed')
      }
    },
    [
      t,
      enabledModels,
      setEnabledModels,
      deleteCustomAi,
      defaultAiModel,
      setDefaultAiModel,
      showError,
      confirm
    ]
  )

  const handleAddSuccess = useCallback(
    (id: string) => {
      if (id && !enabledModels.includes(id)) {
        setEnabledModels([...enabledModels, id])
      }
    },
    [enabledModels, setEnabledModels]
  )

  const handleClearModelData = useCallback(
    async (e: MouseEvent, id: string, name: string) => {
      e.stopPropagation()
      if (
        !(await confirm({
          title: t('confirm_clear_ai_model_data', { name }),
          variant: 'destructive'
        }))
      )
        return

      try {
        const platform = aiSites[id]
        await clearAiModelData({
          id,
          partition: platform?.partition || (platform?.isSite ? undefined : 'persist:ai_session')
        })
        reloadActiveContent()
      } catch (error) {
        Logger.error('[ModelsTab] clearAiModelData failed', error)
        showError('toast_ai_model_data_clear_failed')
      }
    },
    [t, aiSites, clearAiModelData, reloadActiveContent, showError, confirm]
  )

  return (
    <>
      <SettingsCollectionTabShell
        icon={MODELS_ICON}
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
          <SettingsSection icon={<GridIcon className="h-4 w-4" />} title={t('models')}>
            <AiModelList
              modelsList={modelsList}
              enabledModels={enabledModels}
              aiSites={aiSites}
              toggleModel={toggleModel}
              handleDeleteAi={handleDeleteAi}
              handleClearModelData={handleClearModelData}
              isDeleting={isDeleting}
              isClearingModelData={isClearingModelData}
              minEnabledModels={MIN_ENABLED_MODELS}
              defaultAiModel={defaultAiModel}
              setDefaultAiModel={setDefaultAiModel}
              t={t}
            />
          </SettingsSection>
        }
        footer={
          <div className="border-border/60 space-y-1 border-t px-1 pt-4">
            <p className="text-ql-12 text-muted-foreground">
              {t('active_models')}:{' '}
              <span className="text-foreground tabular-nums">
                {enabledModelsCount} / {modelsList.length}
              </span>{' '}
              {t('models_count')}
            </p>
            <p className="text-ql-12 text-muted-foreground">
              {t('google_models_managed_separately')}
            </p>
          </div>
        }
      />
      <ConfirmDialog {...confirmProps} />
    </>
  )
})

ModelsTab.displayName = 'ModelsTab'

export default ModelsTab
