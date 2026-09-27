import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'

import { useAppearance } from '@app/providers'
import { useAiModelActions, useAiModelsCatalog } from '@app/providers/ai-context'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { DURATION } from '@shared/lib/motion'
import {
  SettingsSection,
  SettingsTabIcon,
  SettingsTabIntro
} from '@shared/ui/components/primitives'
import { getAiIcon, GridIcon, SliderIcon } from '@ui/components/Icons'

import { Field, Label } from '@headlessui/react'
import { GripVertical } from 'lucide-react'
import { motion, Reorder } from 'motion/react'
import { memo, type ReactNode, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

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

/** Shared row shell: dense toggle row, motion-safe, colour transitions only. */
const ROW_BASE =
  'motion-normal flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors'

/** Enabled row uses the accent surface, disabled row the translucent card. */
const ROW_ACTIVE = 'border-ring/50 bg-accent/30'
const ROW_IDLE = 'border-border/60 bg-card hover:bg-muted/50'

/**
 * The drag handle repeats on every model row, so it stays hidden at rest and
 * fades in on hover/focus instead of forming a wall of identical icons. The
 * brand/identity icon beside it always stays visible.
 */
const HOVER_AFFORDANCE =
  'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 group-focus-visible:opacity-100 motion-reduce:opacity-100'

const BOTTOM_BAR_ICON = (
  <SettingsTabIcon>
    <SliderIcon className="h-5 w-5" />
  </SettingsTabIcon>
)

/** Uppercase micro label + hairline rule, used as the section's closing caption. */
function SectionCaption({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2">
      <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold uppercase">
        {children}
      </span>
      <span aria-hidden className="bg-border h-px flex-1" />
    </div>
  )
}

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
    (toolId: string) => setVisibleTool(toolId, visibleTools[toolId] === false),
    [visibleTools, setVisibleTool]
  )

  const handleToggleModel = useCallback(
    (modelId: string) => setVisibleModel(modelId, visibleModels[modelId] === false),
    [visibleModels, setVisibleModel]
  )

  const handleReorder = useCallback(
    (newOrder: string[]) => setEnabledModels(newOrder),
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
      <SettingsTabIntro icon={BOTTOM_BAR_ICON} description={t('bottom_bar_description')} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.fast }}
      >
        <SettingsSection
          icon={<SliderIcon className="h-4 w-4" />}
          title={t('tools_visibility')}
          detail={t('tools_visibility_desc')}
        >
          <div className="flex flex-col gap-1.5">
            {visibleToolsFiltered.map((tool) => {
              const isVisible = visibleTools[tool.id] !== false
              return (
                <Field
                  key={tool.id}
                  className={`group ${ROW_BASE} ${isVisible ? ROW_ACTIVE : ROW_IDLE}`}
                  onClick={() => handleToggleTool(tool.id)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                        isVisible ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                      }`}
                    />
                    <Label className="text-foreground text-ql-12 min-w-0 cursor-pointer truncate font-medium">
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

          <SectionCaption>
            {visibleToolCount} / {visibleToolsFiltered.length} tools visible
          </SectionCaption>
        </SettingsSection>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.fast, delay: 0.05 }}
      >
        <SettingsSection
          icon={<GridIcon className="h-4 w-4" />}
          title={t('model_visibility')}
          detail={t('model_visibility_desc')}
        >
          <Reorder.Group
            axis="y"
            values={enabledModels}
            onReorder={handleReorder}
            className="flex flex-col gap-1.5"
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
                  className="group cursor-grab active:cursor-grabbing"
                  aria-roledescription="sortable"
                  aria-label={t('model_sort_label', {
                    name: displayName
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
                    className={`${ROW_BASE} ${isVisible ? ROW_ACTIVE : ROW_IDLE}`}
                    onClick={() => handleToggleModel(modelId)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <GripVertical
                        aria-hidden="true"
                        className={`${HOVER_AFFORDANCE} text-muted-foreground h-4 w-4 shrink-0`}
                      />
                      <div className="flex size-5 shrink-0 items-center justify-center">
                        {getAiIcon(modelId) || (
                          <span className="text-muted-foreground text-ql-12 font-semibold">
                            {displayName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <Label className="text-foreground text-ql-12 min-w-0 cursor-pointer truncate font-medium">
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

          <SectionCaption>
            {visibleModelCount} / {enabledModels.length} models visible
          </SectionCaption>
        </SettingsSection>
      </motion.div>
    </div>
  )
})

BottomBarSettingsTab.displayName = 'BottomBarSettingsTab'
export default BottomBarSettingsTab
