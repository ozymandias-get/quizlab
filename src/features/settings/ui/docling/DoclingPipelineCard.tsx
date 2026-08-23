import {
  useDoclingPipelinePrefs,
  useDoclingPipelineSetPrefs
} from '@platform/electron/api/useDoclingPipelineApi'

import { SurfaceCard } from '@shared/ui/components/primitives'

import { FileSearch, Image as ImageIcon, Table, Zap } from 'lucide-react'
import { memo } from 'react'

import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

interface Props {
  isInstalled: boolean
}

const DoclingPipelineCard = memo(function DoclingPipelineCard({ isInstalled }: Props) {
  const { data: prefs, isLoading } = useDoclingPipelinePrefs()
  const setPrefs = useDoclingPipelineSetPrefs()

  const busy = setPrefs.isPending || isLoading

  const Row = ({
    icon: Icon,
    title,
    desc,
    checked,
    onChange,
    disabledReason
  }: {
    icon: typeof FileSearch
    title: string
    desc: string
    checked: boolean
    onChange: (v: boolean) => void
    disabledReason?: string | null
  }) => (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex gap-2.5">
        <div className="bg-muted text-muted-foreground mt-0.5 rounded-md p-1.5">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-ql-13 leading-4 font-medium">{title}</p>
          <p className="text-ql-11 text-muted-foreground leading-4">{desc}</p>
          {disabledReason && (
            <p className="text-ql-11 text-amber-600 dark:text-amber-400">{disabledReason}</p>
          )}
        </div>
      </div>
      <SettingsToggleSwitch
        checked={checked}
        onChange={onChange}
        disabled={busy || !isInstalled || !!disabledReason}
      />
    </div>
  )

  if (isLoading) {
    return (
      <SurfaceCard className="p-5">
        <p className="text-ql-13 text-muted-foreground">Yükleniyor…</p>
      </SurfaceCard>
    )
  }

  const p = prefs ?? { doOcr: false, extractFigures: false, detectTables: true, fastTables: true }

  return (
    <SurfaceCard className="space-y-1 p-5">
      <div className="mb-3">
        <h3 className="text-ql-13 font-semibold">Dönüşüm Ayarları</h3>
        <p className="text-ql-11 text-muted-foreground">
          Hız ve kalite dengesi. Değişiklik bir sonraki dönüşümde ve önbellek miss&apos;te etkili
          olur.
        </p>
      </div>

      <Row
        icon={FileSearch}
        title="OCR (taranmış PDF)"
        desc="Kapalı = daha hızlı. Metin yoksa otomatik tekrar dener."
        checked={!!p.doOcr}
        onChange={(v) => setPrefs.mutate({ doOcr: v })}
      />
      <Row
        icon={ImageIcon}
        title="Şekilleri çıkar"
        desc="Görselleri ayıklar. Kapalı = %25-40 daha hızlı."
        checked={!!p.extractFigures}
        onChange={(v) => setPrefs.mutate({ extractFigures: v })}
      />
      <Row
        icon={Table}
        title="Tabloları algıla"
        desc="Tablo yapısını korur. Kapatırsan tablo → paragraf olur."
        checked={!!p.detectTables}
        onChange={(v) => setPrefs.mutate({ detectTables: v })}
      />
      <Row
        icon={Zap}
        title="Hızlı tablo modu"
        desc="FAST: %30-50 daha hızlı, ACCURATE: daha keskin."
        checked={!!p.fastTables}
        onChange={(v) => setPrefs.mutate({ fastTables: v })}
        disabledReason={!p.detectTables ? 'Önce “Tabloları algıla”yı aç' : null}
      />
    </SurfaceCard>
  )
})

export default DoclingPipelineCard
