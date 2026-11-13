import type { AiPlatform } from '@shared-core/types'

import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '@app/components/ui/dialog'
import { Input } from '@app/components/ui/input'
import type { Tab } from '@app/providers/ai-context'
import { getElectronApi } from '@shared/lib/electronApi'
import { Button } from '@shared/ui/components/primitives'
import { getAiIcon } from '@ui/components/Icons'

import { ArrowLeft, Pin } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PinAiProjectDialogProps {
  aiSites: Record<string, AiPlatform>
  getTabUrl: (tabId: string, modelId: string) => string | undefined
  initialTabId: string
  isOpen: boolean
  tabs: Tab[]
  onClose: () => void
  onSave: (input: { modelId: string; name: string; url: string }) => void
}

function getTabLabel(tab: Tab, aiSites: Record<string, AiPlatform>): string {
  const site = aiSites[tab.modelId]
  return site?.displayName || site?.name || tab.modelId
}

const PinAiProjectDialog = function PinAiProjectDialog({
  aiSites,
  getTabUrl,
  initialTabId,
  isOpen,
  tabs,
  onClose,
  onSave
}: PinAiProjectDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [step, setStep] = useState<'tab' | 'name'>('name')
  const [selectedTabId, setSelectedTabId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const pinnableTabs = useMemo(() => tabs.filter((tab) => tab.modelId !== 'api-chat'), [tabs])

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return
    wasOpenRef.current = true

    const initial =
      pinnableTabs.find((tab) => tab.id === initialTabId) ?? pinnableTabs[0] ?? undefined
    setSelectedTabId(initial?.id ?? '')
    setStep(pinnableTabs.length > 1 ? 'tab' : 'name')
    setName(initial ? getTabLabel(initial, aiSites) : '')
    setError(null)
    setIsSaving(false)
  }, [aiSites, initialTabId, isOpen, pinnableTabs])

  useEffect(() => {
    if (!isOpen || step !== 'name') return
    const frame = requestAnimationFrame(() => nameInputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [isOpen, step])

  const selectedTab = pinnableTabs.find((tab) => tab.id === selectedTabId) ?? pinnableTabs[0]

  const handleContinue = useCallback(() => {
    if (!selectedTab) return
    setName((current) => current.trim() || getTabLabel(selectedTab, aiSites))
    setStep('name')
  }, [aiSites, selectedTab])

  const handleSave = useCallback(async () => {
    if (!selectedTab || !name.trim() || isSaving) return
    setIsSaving(true)
    setError(null)

    let url = getTabUrl(selectedTab.id, selectedTab.modelId)
    if (!url) {
      url =
        (await getElectronApi()
          ?.aiView.getUrl({ viewId: selectedTab.id })
          .catch(() => null)) ?? undefined
    }
    url ??= aiSites[selectedTab.modelId]?.url

    if (!url) {
      setError(t('ai_home.pin_url_missing'))
      setIsSaving(false)
      return
    }

    onSave({ modelId: selectedTab.modelId, name: name.trim(), url })
    onClose()
  }, [aiSites, getTabUrl, isSaving, name, onClose, onSave, selectedTab, t])

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      ariaLabelledBy={titleId}
      ariaDescribedBy={descriptionId}
      panelClassName="border-white/10 bg-zinc-900/95 px-6 py-5 shadow-2xl backdrop-blur-xl"
    >
      <DialogTitle id={titleId}>{t('ai_home.pin_dialog_title')}</DialogTitle>
      <DialogDescription id={descriptionId}>
        {step === 'tab' ? t('ai_home.pin_choose_tab') : t('ai_home.pin_dialog_description')}
      </DialogDescription>

      {step === 'tab' ? (
        <div className="custom-scrollbar mt-4 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
          {pinnableTabs.map((tab) => {
            const site = aiSites[tab.modelId]
            const label = getTabLabel(tab, aiSites)
            const icon = getAiIcon(site?.icon || tab.modelId)
            const isSelected = tab.id === selectedTab?.id
            const tabUrl = getTabUrl(tab.id, tab.modelId)
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTabId(tab.id)}
                aria-pressed={isSelected}
                className={`motion-normal focus-visible:ring-ring/70 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  isSelected
                    ? 'border-white/15 bg-white/[0.07]'
                    : 'border-transparent hover:bg-white/5'
                }`}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                  {icon ?? (
                    <span className="text-primary text-ql-12 font-bold uppercase" aria-hidden>
                      {label.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-ql-13 text-foreground truncate font-medium">{label}</div>
                  {tabUrl && (
                    <div className="text-ql-10 text-muted-foreground mt-0.5 truncate">
                      {tabUrl.replace(/^https?:\/\//, '')}
                    </div>
                  )}
                </div>
                {isSelected && <Pin aria-hidden className="text-primary h-3.5 w-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mt-4">
          <label
            htmlFor={`${titleId}-name`}
            className="text-ql-12 text-foreground mb-1.5 block font-medium"
          >
            {t('ai_home.pin_name_label')}
          </label>
          <Input
            ref={nameInputRef}
            id={`${titleId}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('ai_home.pin_name_placeholder')}
            maxLength={80}
            className="border-white/10 bg-zinc-950/60 focus-visible:border-white/20"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSave()
              }
            }}
          />
          {selectedTab && (
            <div className="text-ql-11 text-muted-foreground mt-2 flex items-center gap-1.5">
              <Pin aria-hidden className="h-3 w-3" />
              {getTabLabel(selectedTab, aiSites)}
            </div>
          )}
          {error && <p className="text-ql-11 text-destructive mt-2">{error}</p>}
        </div>
      )}

      <DialogFooter>
        {step === 'tab' ? (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={handleContinue} disabled={!selectedTab}>
              {t('ai_home.pin_next')}
            </Button>
          </>
        ) : (
          <>
            {pinnableTabs.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setStep('tab')}>
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('ai_home.pin_back')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={!name.trim() || isSaving}>
              <Pin className="h-3.5 w-3.5" />
              {t('ai_home.pin_save')}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  )
}

export default PinAiProjectDialog
