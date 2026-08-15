import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'

import { useAppearance } from '@app/providers'
import { useAiModelActions, useAiModelsCatalog } from '@app/providers/AiContext'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { GridIcon, SliderIcon } from '@ui/components/Icons'
import { getAiIcon } from '@ui/components/Icons'

import { Field, Label } from '@headlessui/react'
import { GripVertical } from 'lucide-react'
import { motion, Reorder } from 'motion/react'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import SettingsTabIntro from './shared/SettingsTabIntro'
import SettingsToggleSwitch from './shared/SettingsToggleSwitch'

interface ToolItem {
  id: string
  nameKey: string
}

const TOOL_LIST: ToolItem[] = [
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_SETTINGS, nameKey: 'tool_settings' },
  { id: 'tool-gemini-web', nameKey: 'tool_gemini' },
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_SWAP, nameKey: 'tool_swap' },
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_PDF_FOCUS, nameKey: 'tool_pdf_focus' },
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_AI_FOCUS, nameKey: 'tool_ai_focus' },
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_PICKER, nameKey: 'tool_picker' }
]

const BOTTOM_BAR_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-xl border p-2.5">
    <SliderIcon className="h-5 w-5" />
  </div>
)

const BottomBarSettingsTab = memo(() => {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const { data: webSessionData } = useGeminiWebStatus()
  const isGeminiWebEnabled = !!webSessionData?.featureEnabled && !!webSessionData?.enabled
  const { enabledModels, aiSites } = useAiModelsCatalog()
  const { setEnabledModels } = useAiModelActions()

  const { visibleTools, setVisibleTool, visibleModels, setVisibleModel } = useAppearance(
    useShallow((s) => ({
      visibleTools: s.visibleTools,
      setVisibleTool: s.setVisibleTool,
      visibleModels: s.visibleModels,
      setVisibleModel: s.setVisibleModel
    }))
  )

  const visibleToolsFiltered = useMemo(
    () => TOOL_LIST.filter((tool) => tool.id !== 'tool-gemini-web' || isGeminiWebEnabled),
    [isGeminiWebEnabled]
  )

  const handleToggleTool = useCallback(
    (toolId: string) => {
      const currentVisible = visibleTools[toolId] !== false
      setVisibleTool(toolId, !currentVisible)
    },
    [visibleTools, setVisibleTool]
  )

  const handleToggleModel = useCallback(
    (modelId: string) => {
      const currentVisible = visibleModels[modelId] !== false
      setVisibleModel(modelId, !currentVisible)
    },
    [visibleModels, setVisibleModel]
  )

  const handleReorder = useCallback(
    (newOrder: string[]) => {
      setEnabledModels(newOrder)
    },
    [setEnabledModels]
  )

  const visibleToolCount = useMemo(
    () => visibleToolsFiltered.filter((tool) => visibleTools[tool.id] !== false).length,
    [visibleToolsFiltered, visibleTools]
  )

  const visibleModelCount = useMemo(
    () => enabledModels.filter((modelId) => visibleModels[modelId] !== false).length,
    [enabledModels, visibleModels]
  )

  return (
    <div className="space-y-6" data-app-locale={language}>
      <SettingsTabIntro
        icon={BOTTOM_BAR_ICON}
        eyebrow={t('bottom_bar')}
        title={t('bottom_bar')}
        description={t('bottom_bar_description')}
      />

      {/* Tools Visibility Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.05 }}
        className="bg-card border-border space-y-4 rounded-xl border p-5 shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="border-border bg-muted text-primary rounded-lg border p-2">
            <SliderIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-foreground text-sm font-bold">{t('tools_visibility')}</h3>
            <p className="text-ql-12 text-muted-foreground">{t('tools_visibility_desc')}</p>
          </div>
        </div>

        <div className="space-y-1">
          {visibleToolsFiltered.map((tool) => {
            const isVisible = visibleTools[tool.id] !== false

            return (
              <Field
                key={tool.id}
                className={`group flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors duration-150 ${
                  isVisible
                    ? 'border-primary/30 bg-muted/70 shadow-xs'
                    : 'bg-card border-border hover:bg-muted/40'
                } `}
                onClick={() => handleToggleTool(tool.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full transition-colors duration-200 ${isVisible ? 'bg-emerald-500 shadow-xs' : 'bg-muted-foreground/30'} `}
                  />
                  <Label className="text-foreground cursor-pointer text-xs font-medium">
                    {t(tool.nameKey, { defaultValue: tool.id })}
                  </Label>
                </div>
                <SettingsToggleSwitch
                  checked={isVisible}
                  onChange={() => handleToggleTool(tool.id)}
                  size="sm"
                />
              </Field>
            )
          })}
        </div>

        <div className="text-ql-11 text-muted-foreground pt-1 tracking-wide">
          {visibleToolCount} / {visibleToolsFiltered.length} tools visible
        </div>
      </motion.div>

      {/* Model Visibility Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.05, delay: 0.05 }}
        className="bg-card border-border space-y-4 rounded-xl border p-5 shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="border-border bg-muted text-primary rounded-lg border p-2">
            <GridIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-foreground text-sm font-bold">{t('model_visibility')}</h3>
            <p className="text-ql-12 text-muted-foreground">{t('model_visibility_desc')}</p>
          </div>
        </div>

        <Reorder.Group
          axis="y"
          values={enabledModels}
          onReorder={handleReorder}
          className="space-y-1"
        >
          {enabledModels.map((modelId) => {
            const site = aiSites[modelId]
            if (!site) return null
            const isVisible = visibleModels[modelId] !== false
            const displayName = site.displayName || site.name || modelId

            return (
              <Reorder.Item
                key={modelId}
                value={modelId}
                className="cursor-grab active:cursor-grabbing"
                aria-roledescription="sortable"
                aria-label={t('model_sort_label', {
                  defaultValue: `${displayName} - ${t('drag_to_reorder', { defaultValue: 'Drag to reorder' })}`
                })}
                onKeyDown={(e) => {
                  const items = enabledModels
                  const idx = items.indexOf(modelId)
                  if (e.key === 'ArrowUp' && idx > 0) {
                    e.preventDefault()
                    const newOrder = [...items]
                    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
                    handleReorder(newOrder)
                  } else if (e.key === 'ArrowDown' && idx < items.length - 1) {
                    e.preventDefault()
                    const newOrder = [...items]
                    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
                    handleReorder(newOrder)
                  }
                }}
              >
                <Field
                  className={`group flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors duration-150 ${
                    isVisible
                      ? 'border-primary/30 bg-muted/70 shadow-xs'
                      : 'bg-card border-border hover:bg-muted/40'
                  } `}
                  onClick={() => handleToggleModel(modelId)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical
                      className="text-muted-foreground/60 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex h-5 w-5 items-center justify-center">
                      {getAiIcon(modelId) || (
                        <span className="text-muted-foreground text-xs font-bold">
                          {displayName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <Label className="text-foreground cursor-pointer text-xs font-medium">
                      {displayName}
                    </Label>
                  </div>
                  <SettingsToggleSwitch
                    checked={isVisible}
                    onChange={() => handleToggleModel(modelId)}
                    size="sm"
                  />
                </Field>
              </Reorder.Item>
            )
          })}
        </Reorder.Group>

        <div className="text-ql-11 text-muted-foreground pt-1 tracking-wide">
          {visibleModelCount} / {enabledModels.length} models visible
        </div>
      </motion.div>
    </div>
  )
})

BottomBarSettingsTab.displayName = 'BottomBarSettingsTab'

export default BottomBarSettingsTab
