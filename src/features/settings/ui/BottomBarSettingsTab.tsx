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
  <div className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/20 to-cyan-500/20 p-2.5 text-sky-400">
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

  const visibleToolCount = useMemo(() => {
    return Object.values(visibleTools).filter(Boolean).length
  }, [visibleTools])

  const visibleModelCount = useMemo(() => {
    return enabledModels.filter((id) => visibleModels[id] !== false).length
  }, [enabledModels, visibleModels])

  const visibleToolsFiltered = useMemo(() => {
    return TOOL_LIST.filter((tool) => tool.id !== 'tool-gemini-web' || isGeminiWebEnabled)
  }, [isGeminiWebEnabled])

  const handleToggleTool = useCallback(
    (toolId: string) => {
      setVisibleTool(toolId, !visibleTools[toolId])
    },
    [visibleTools, setVisibleTool]
  )

  const handleToggleModel = useCallback(
    (modelId: string) => {
      setVisibleModel(modelId, visibleModels[modelId] !== false ? false : true)
    },
    [visibleModels, setVisibleModel]
  )

  const handleReorder = useCallback(
    (newOrder: string[]) => {
      setEnabledModels(newOrder)
    },
    [setEnabledModels]
  )

  return (
    <div className="space-y-6" data-app-locale={language}>
      <SettingsTabIntro
        icon={
          <div className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/20 to-cyan-500/20 p-2.5 text-sky-400">
            <SliderIcon className="h-5 w-5" />
          </div>
        }
        eyebrow={t('bottom_bar')}
        title={t('bottom_bar')}
        description={t('bottom_bar_description')}
      />

      {/* Tools Visibility Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.05 }}
        className="bg-card space-y-4 rounded-xl border border-white/[0.05] p-5"
      >
        <div className="flex items-center gap-3">
          <div className="border-border rounded-lg border bg-white/[0.04] p-2 text-white/30">
            <SliderIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-foreground text-sm font-bold">{t('tools_visibility')}</h3>
            <p className="text-ql-11 tracking-wide text-white/34">{t('tools_visibility_desc')}</p>
          </div>
        </div>

        <div className="space-y-1">
          {visibleToolsFiltered.map((tool) => {
            const isVisible = visibleTools[tool.id] !== false

            return (
              <Field
                key={tool.id}
                className={`group flex cursor-pointer items-center justify-between rounded-[16px] border p-3 transition-colors duration-300 ${
                  isVisible
                    ? 'border-white/[0.12] bg-white/[0.06] shadow-lg'
                    : 'bg-card border-white/[0.05] hover:bg-white/[0.04]'
                } `}
                onClick={() => handleToggleTool(tool.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full transition-colors duration-300 ${isVisible ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-white/20'} `}
                  />
                  <Label className="text-foreground/90 cursor-pointer text-xs font-medium">
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

        <div className="text-ql-11 pt-1 tracking-wide text-white/30">
          {visibleToolCount} / {visibleToolsFiltered.length} tools visible
        </div>
      </motion.div>

      {/* Model Visibility Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.05, delay: 0.05 }}
        className="bg-card space-y-4 rounded-xl border border-white/[0.05] p-5"
      >
        <div className="flex items-center gap-3">
          <div className="border-border rounded-lg border bg-white/[0.04] p-2 text-white/30">
            <GridIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-foreground text-sm font-bold">{t('model_visibility')}</h3>
            <p className="text-ql-11 tracking-wide text-white/34">{t('model_visibility_desc')}</p>
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
                  className={`group flex cursor-pointer items-center justify-between rounded-[16px] border p-3 transition-colors duration-300 ${
                    isVisible
                      ? 'border-white/[0.12] bg-white/[0.06] shadow-lg'
                      : 'bg-card border-white/[0.05] hover:bg-white/[0.04]'
                  } `}
                  onClick={() => handleToggleModel(modelId)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 text-white/20" aria-hidden="true" />
                    <div className="flex h-5 w-5 items-center justify-center">
                      {getAiIcon(modelId) || (
                        <span className="text-xs font-bold text-white/60">
                          {displayName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <Label className="text-foreground/90 cursor-pointer text-xs font-medium">
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

        <div className="text-ql-11 pt-1 tracking-wide text-white/30">
          {visibleModelCount} / {enabledModels.length} models visible
        </div>
      </motion.div>
    </div>
  )
})

BottomBarSettingsTab.displayName = 'BottomBarSettingsTab'

export default BottomBarSettingsTab
