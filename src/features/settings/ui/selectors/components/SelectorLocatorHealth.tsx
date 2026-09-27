import type { AiSelectorConfig, SelectorRepairKind } from '@shared-core/types'

import type { SelectorHealthState, TranslateFn } from '../types'

/**
 * Per-locator health row for the Settings › Selectors card.
 *
 * The card-level badge answers "does this site work at all?", but self-healing
 * tracks the composer field and its send button independently — they drift for
 * different reasons and carry different risk. Showing them separately is what
 * makes "the input was auto-repaired but the button still needs a re-pick"
 * legible instead of a single misleading "Ready".
 */
interface SelectorLocatorHealthProps {
  config: AiSelectorConfig | null
  t: TranslateFn
}

interface LocatorRow {
  kind: SelectorRepairKind
  labelKey: string
  hasLocator: boolean
  repaired: boolean
  confidenceLevel: 'high' | 'medium' | 'low' | null
  repairedAt: number | null
  awaitingPromotion: boolean
}

function resolveRow(config: AiSelectorConfig | null, kind: SelectorRepairKind): LocatorRow {
  const primary = kind === 'input' ? config?.input : config?.button
  const candidates = kind === 'input' ? config?.inputCandidates : config?.buttonCandidates
  const fingerprint = kind === 'input' ? config?.inputFingerprint : config?.buttonFingerprint
  const hasLocator = Boolean(primary || candidates?.length || fingerprint)

  const lastRepair = config?.lastRepair
  const lastSelector = kind === 'input' ? lastRepair?.inputSelector : lastRepair?.buttonSelector
  const repaired = Boolean(lastSelector) && primary === lastSelector
  const staged = config?.repair?.[kind] ?? null

  return {
    kind,
    labelKey: kind === 'input' ? 'input_label' : 'picker_el_submit',
    hasLocator,
    repaired,
    confidenceLevel: repaired ? (staged?.confidenceLevel ?? 'high') : null,
    repairedAt: repaired ? (lastRepair?.repairedAt ?? null) : null,
    awaitingPromotion: Boolean(staged)
  }
}

function resolveHealthState(row: LocatorRow, configHealth: SelectorHealthState): string {
  if (configHealth === 'needs_repick' || !row.hasLocator) return 'needs_repick'
  if (row.repaired) return 'repaired'
  if (configHealth === 'migrated') return 'migrated'
  return 'ready'
}

const STATE_STYLES: Record<string, string> = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  migrated: 'border-primary/30 bg-primary/10 text-primary',
  repaired: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  needs_repick: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  missing: 'border-border/60 bg-muted text-muted-foreground'
}

export default function SelectorLocatorHealth({ config, t }: SelectorLocatorHealthProps) {
  const rows = [resolveRow(config, 'input'), resolveRow(config, 'button')]
  const configHealth: SelectorHealthState = config?.health ?? 'ready'

  return (
    <div className="border-border/60 bg-background/40 flex flex-col gap-2 rounded-xl border p-4">
      <div className="text-muted-foreground flex items-center gap-2">
        <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold uppercase">
          {t('selectors_locator_health_label')}
        </span>
        <span aria-hidden className="bg-border h-px flex-1" />
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const state = row.hasLocator ? resolveHealthState(row, configHealth) : 'missing'
          return (
            <li key={row.kind} className="flex flex-wrap items-center gap-2">
              <span className="text-ql-12 text-foreground w-16 shrink-0 font-medium">
                {t(row.labelKey)}
              </span>
              <span
                className={`text-ql-10 rounded-full border px-2 py-0.5 font-medium ${
                  STATE_STYLES[state] ?? STATE_STYLES.missing
                }`}
              >
                {t(`selectors_health_${state}`)}
              </span>
              {row.repaired && (
                <span className="text-ql-11 text-muted-foreground">
                  {t('selectors_repair_summary', {
                    confidence: t(`selectors_confidence_${row.confidenceLevel ?? 'high'}`),
                    date: row.repairedAt ? new Date(row.repairedAt).toLocaleDateString() : '—'
                  })}
                </span>
              )}
              {row.awaitingPromotion && !row.repaired && (
                <span className="text-ql-11 text-muted-foreground">
                  {t('selectors_repair_pending')}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
