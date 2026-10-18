/**
 * Shared mock scaffolding for the two Settings → Selectors render suites.
 *
 * `SelectorsTab.test.tsx` and `SelectorsTab.repairHealth.test.tsx` render the
 * same component through the same dependency graph and therefore need the same
 * icon, motion, provider and platform stubs. They used to each declare their
 * own copy, which meant a new icon export added to the barrel broke (or worse,
 * silently half-worked in) one suite but not the other.
 *
 * Usage: the `vi.mock` factories are hoisted above the imports, so the stubs
 * are pulled in lazily.
 *
 *   vi.mock('@ui/components/Icons', async () =>
 *     (await import('./selectorsTabHarness')).selectorsTabIconStubs)
 */
const stub =
  (label: string) =>
  ({ className }: { className?: string }) => <span className={className}>{label}</span>

export const selectorsTabIconStubs = {
  CheckIcon: stub('CheckIcon'),
  ChevronRightIcon: stub('ChevronRightIcon'),
  ExternalLinkIcon: stub('ExternalLinkIcon'),
  GlobeIcon: stub('GlobeIcon'),
  LoaderIcon: stub('LoaderIcon'),
  MagicWandIcon: stub('MagicWandIcon'),
  RefreshIcon: stub('RefreshIcon'),
  SelectorIcon: stub('SelectorIcon'),
  TrashIcon: stub('TrashIcon'),
  getAiIcon: vi.fn((_icon: string) => null)
}

export const selectorsTabMotionStubs = {
  motion: {
    div: ({ children, layout: _layout, ...props }: any) => <div {...props}>{children}</div>
  }
}

export interface SelectorsTabStubOptions {
  aiSites: Record<string, unknown>
  tabs: unknown[]
  currentAI: string
  openAiWorkspace: (ai: string) => void
  startPickerWhenReady: () => void
  showError: (...args: unknown[]) => void
  showSuccess: (...args: unknown[]) => void
  showWarning: (...args: unknown[]) => void
  enabledModels?: string[]
  defaultAiModel?: string
  getContentController?: () => unknown
  hasActiveContent?: boolean
  aiConfig: unknown
  saveAiConfig: (...args: any[]) => Promise<unknown>
  deleteConfig: (...args: any[]) => Promise<unknown>
  generateValidateSelectorsScript: (...args: any[]) => Promise<unknown>
  logError: (...args: unknown[]) => void
}

/**
 * Every non-React dependency `SelectorsTab` pulls in, keyed by module id so a
 * suite can wire them with:
 *
 *   vi.mock(SPECIFIERS_MODULES[0], async () =>
 *     (await import('./selectorsTabHarness')).selectorsTabModuleStubs(options)[SPECIFIERS_MODULES[0]])
 *
 * …or, more readably, one `vi.mock` per id as in the suites themselves.
 */
export function selectorsTabModuleStubs(options: SelectorsTabStubOptions) {
  return {
    '@app/providers': {
      useAppToolActions: () => ({ startPickerWhenReady: options.startPickerWhenReady }),
      useToastActions: () => ({
        showError: options.showError,
        showSuccess: options.showSuccess,
        showWarning: options.showWarning
      })
    },
    '@app/providers/ai-context': {
      useAiTabsList: () => ({ tabs: options.tabs }),
      useAiTabFocus: () => ({ currentAI: options.currentAI }),
      useAiSites: () => options.aiSites,
      useAiModelsCatalog: () => ({
        aiSites: options.aiSites,
        enabledModels: options.enabledModels ?? [],
        defaultAiModel: options.defaultAiModel ?? options.currentAI
      }),
      useAiTabActions: () => ({ openAiWorkspace: options.openAiWorkspace }),
      useAiContent: () => ({
        getContentController: () => options.getContentController?.() ?? null
      }),
      useAiContentPresence: () => ({ hasActiveContent: options.hasActiveContent ?? false })
    },
    '@platform/electron/api/useAiApi': {
      useSaveAiConfig: () => ({ mutateAsync: options.saveAiConfig, isPending: false })
    },
    '@platform/electron/api/useSettingsAiApi': {
      useAiConfig: () => ({ data: options.aiConfig }),
      useDeleteAiConfig: () => ({ mutateAsync: options.deleteConfig, isPending: false })
    },
    '@platform/electron/api/useAutomationApi': {
      useGenerateValidateSelectorsScript: () => ({
        mutateAsync: options.generateValidateSelectorsScript,
        isPending: false
      })
    },
    '@shared/lib/logger': {
      Logger: { error: options.logError, info: vi.fn(), warn: vi.fn() }
    }
  }
}

/**
 * Stub for `react-i18next`.
 *
 * `renderParams: true` renders `key:{"…":…}` so a suite can assert on
 * interpolated labels; the default is a passthrough `t`, which is what most
 * label assertions want.
 */
export function selectorsTabI18nStubs(options?: { renderParams?: boolean }) {
  return {
    useTranslation: () => ({
      t: (key: string, params?: Record<string, string>) =>
        options?.renderParams && params ? `${key}:${JSON.stringify(params)}` : key,
      i18n: { language: 'en' }
    })
  }
}
