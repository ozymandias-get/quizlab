import { isAiDockVisible } from '@shared-core/constants/aiChatCatalog'

import {
  hasEnabledSiteSession,
  useSiteSessionListQuery
} from '@platform/electron/api/useSiteSessionApi'

import { BlurFade } from '@app/components/ui/blur-fade'
import { useAppearance } from '@app/providers'
import { useAiModelActions, useAiModelsCatalog } from '@app/providers/ai-context'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { DURATION } from '@shared/lib/motion'
import {
  SettingsSection,
  SettingsTabIcon,
  SettingsTabIntro
} from '@shared/ui/components/primitives'
import { GridIcon, SliderIcon } from '@ui/components/Icons'

import { Field, Label } from '@headlessui/react'
import { motion, Reorder } from 'motion/react'
import { memo, type ReactNode, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import BottomBarModelRow from './BottomBarModelRow'
import SettingsToggleSwitch from './shared/SettingsToggleSwitch'

interface ToolItem {
  id: string
  nameKey: string
}

/**
 * Same top-to-bottom order as `FloatingDockInner` renders the dock. Keeping the
 * settings list in visual order is what lets a schedule read "turn this off and
 * that slot empties" without mentally mapping two different orders.
 */
const TOOL_LIST: ToolItem[] = [
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_SETTINGS, nameKey: 'tool_settings' },
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_SWAP, nameKey: 'tool_swap' },
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_PDF_FOCUS, nameKey: 'tool_pdf_focus' },
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_AI_FOCUS, nameKey: 'tool_ai_focus' },
  { id: APP_CONSTANTS.TOUR_TARGETS.TOOL_PICKER, nameKey: 'tool_picker' },
  { id: 'tool-gemini-web', nameKey: 'tool_site_sessions' }
]

/** Shared row shell: dense toggle row, motion-safe, colour transitions only. */
const ROW_BASE =
  'motion-normal flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors'

/** Enabled row uses the accent surface, disabled row the translucent card. */
const ROW_ACTIVE = 'border-white/[0.07] bg-zinc-950/80'
const ROW_IDLE = 'border-white/[0.07] bg-zinc-900/45 hover:bg-white/5'

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
  const { t } = useTranslation()
  const { data: siteSessionData } = useSiteSessionListQuery()
  const isSiteSessionEnabled = hasEnabledSiteSession(siteSessionData?.views ?? [])
  const { enabledModels, aiSites, favoriteModels = [] } = useAiModelsCatalog()
  const { setEnabledModels } = useAiModelActions()

  const {
    visibleTools,
    setVisibleTool,
    visibleModels,
    setVisibleModel,
    bottomBarMaxIcons,
    setBottomBarMaxIcons
  } = useAppearance(
    useShallow((s) => ({
      visibleTools: s.visibleTools,
      setVisibleTool: s.setVisibleTool,
      visibleModels: s.visibleModels,
      setVisibleModel: s.setVisibleModel,
      bottomBarMaxIcons: s.bottomBarMaxIcons ?? 5,
      setBottomBarMaxIcons: s.setBottomBarMaxIcons
    }))
  )

  const visibleToolsFiltered = useMemo(
    () => TOOL_LIST.filter((tool) => tool.id !== 'tool-gemini-web' || isSiteSessionEnabled),
    [isSiteSessionEnabled]
  )

  const handleToggleTool = useCallback(
    (toolId: string) => setVisibleTool(toolId, visibleTools[toolId] === false),
    [visibleTools, setVisibleTool]
  )

  // Model rows get a stable toggle so memo(BottomBarModelRow) survives a
  // visibility change; the latest maps are read from the ref at click time.
  const modelToggleStateRef = useRef({
    visibleModels,
    aiSites,
    favoriteModels,
    setVisibleModel
  })
  modelToggleStateRef.current = {
    visibleModels,
    aiSites,
    favoriteModels,
    setVisibleModel
  }

  const handleToggleModel = useCallback((modelId: string) => {
    const {
      visibleModels: visible,
      aiSites: sites,
      favoriteModels: favorites,
      setVisibleModel: set
    } = modelToggleStateRef.current
    set(modelId, !isAiDockVisible(modelId, visible, sites[modelId], favorites))
  }, [])

  const handleReorder = useCallback(
    (newOrder: string[]) => setEnabledModels(newOrder),
    [setEnabledModels]
  )

  const visibleToolCount = useMemo(
    () => visibleToolsFiltered.filter((tool) => visibleTools[tool.id] !== false).length,
    [visibleToolsFiltered, visibleTools]
  )

  const visibleModelCount = useMemo(
    () =>
      enabledModels.filter(
        (modelId) =>
          aiSites[modelId] &&
          isAiDockVisible(modelId, visibleModels, aiSites[modelId], favoriteModels)
      ).length,
    [enabledModels, visibleModels, aiSites, favoriteModels]
  )

  return (
    <div className="space-y-6">
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
            {visibleToolsFiltered.map((tool, index) => {
              const isVisible = visibleTools[tool.id] !== false
              const isFirst = index === 0
              const isLast = index === visibleToolsFiltered.length - 1
              return (
                <BlurFade key={tool.id} delay={index * 0.03} className="w-full">
                  <Field
                    className={`group ${ROW_BASE} ${isVisible ? ROW_ACTIVE : ROW_IDLE}`}
                    onClick={() => handleToggleTool(tool.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3 self-stretch">
                      {/* Schematic dock rail: one dot per physical slot, joined by
                        a vertical guide so a hidden row maps to an empty slot. */}
                      <span
                        aria-hidden
                        className="relative flex w-3 shrink-0 items-center justify-center self-stretch"
                      >
                        {!isFirst && <span className="bg-border/70 absolute top-0 h-1/2 w-px" />}
                        {!isLast && <span className="bg-border/70 absolute bottom-0 h-1/2 w-px" />}
                        <span
                          className={`ring-card relative z-10 size-2 rounded-full ring-2 transition-colors ${
                            isVisible ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                          }`}
                        />
                      </span>
                      <Label className="text-foreground text-ql-12 min-w-0 cursor-pointer truncate font-medium">
                        {t(tool.nameKey, { defaultValue: tool.id })}
                      </Label>
                    </div>
                    <span role="presentation" onClick={(event) => event.stopPropagation()}>
                      <SettingsToggleSwitch
                        checked={isVisible}
                        onChange={() => handleToggleTool(tool.id)}
                        size="sm"
                      />
                    </span>
                  </Field>
                </BlurFade>
              )
            })}
          </div>

          <SectionCaption>
            {t('tools_visible_count', {
              visible: visibleToolCount,
              total: visibleToolsFiltered.length
            })}
          </SectionCaption>
        </SettingsSection>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.fast, delay: 0.03 }}
      >
        <SettingsSection
          icon={<SliderIcon className="h-4 w-4" />}
          title={t('bottom_bar_max_icons')}
          detail={t('bottom_bar_max_icons_desc')}
        >
          <div className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-zinc-900/55 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-ql-12 font-medium">
                {t('bottom_bar_max_icons_label')}
              </span>
              <span className="text-primary border-primary/20 bg-primary/10 text-ql-12 shrink-0 rounded-md border px-2 py-0.5 font-semibold tabular-nums">
                {bottomBarMaxIcons} {t('bottom_bar_max_icons_unit')}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={bottomBarMaxIcons}
              onChange={(e) => setBottomBarMaxIcons(Number(e.target.value))}
              aria-label={t('bottom_bar_max_icons')}
              className="accent-primary h-2 w-full cursor-pointer rounded-lg bg-white/10"
            />
            <p className="text-muted-foreground text-ql-11">
              {t('bottom_bar_max_icons_hint', { count: bottomBarMaxIcons })}
            </p>
          </div>
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
              const isVisible = isAiDockVisible(modelId, visibleModels, site, favoriteModels)
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
                  <BottomBarModelRow
                    modelId={modelId}
                    site={site}
                    displayName={displayName}
                    isVisible={isVisible}
                    onToggle={handleToggleModel}
                  />
                </Reorder.Item>
              )
            })}
          </Reorder.Group>

          <SectionCaption>
            {visibleModelCount > bottomBarMaxIcons
              ? t('bottom_bar_showing_limited', {
                  visible: visibleModelCount,
                  total: enabledModels.length,
                  limit: bottomBarMaxIcons
                })
              : t('models_visible_count', {
                  visible: visibleModelCount,
                  total: enabledModels.length
                })}
          </SectionCaption>
        </SettingsSection>
      </motion.div>
    </div>
  )
})

BottomBarSettingsTab.displayName = 'BottomBarSettingsTab'
export default BottomBarSettingsTab
