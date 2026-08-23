import {
  useDoclingPipelinePrefs,
  useDoclingPipelineSetPrefs
} from '@platform/electron/api/useDoclingPipelineApi'

import { SurfaceCard } from '@shared/ui/components/primitives'

import {
  ChevronDown,
  Code,
  FileSearch,
  FlaskConical,
  Image as ImageIcon,
  Layers,
  ScanText,
  Server,
  Settings2,
  Table,
  Zap
} from 'lucide-react'
import { memo, useState } from 'react'

import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

interface Props {
  isInstalled: boolean
}

const DoclingPipelineCard = memo(function DoclingPipelineCard({ isInstalled }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
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

  const p = prefs as unknown as Record<string, unknown> as {
    doOcr: boolean
    ocrLang: string
    forceFullPageOcr: boolean
    detectTables: boolean
    fastTables: boolean
    cellMatching: boolean
    doCodeEnrichment: boolean
    doFormulaEnrichment: boolean
    doPictureClassification: boolean
    doPictureDescription: boolean
    extractFigures: boolean
    generatePageImages: boolean
    generateTableImages: boolean
    imagesScale: number
    doChartExtraction: boolean
    forceBackendText: boolean
    enableRemoteServices: boolean
    allowExternalPlugins: boolean
    documentTimeout: number | null
    numThreads: number
    device: string
    enableHeadingHierarchy: boolean
    ocrBatchSize: number
    layoutBatchSize: number
    tableBatchSize: number
    queueMaxSize: number
  } & { doOcr: boolean; extractFigures: boolean; detectTables: boolean; fastTables: boolean }
  const defaults = {
    doOcr: false,
    ocrLang: '',
    forceFullPageOcr: false,
    detectTables: true,
    fastTables: true,
    cellMatching: true,
    doCodeEnrichment: false,
    doFormulaEnrichment: false,
    doPictureClassification: false,
    doPictureDescription: false,
    extractFigures: false,
    generatePageImages: false,
    generateTableImages: false,
    imagesScale: 1.0,
    doChartExtraction: false,
    forceBackendText: false,
    enableRemoteServices: false,
    allowExternalPlugins: false,
    documentTimeout: null as number | null,
    numThreads: 4,
    device: 'auto',
    enableHeadingHierarchy: false,
    ocrBatchSize: 4,
    layoutBatchSize: 4,
    tableBatchSize: 4,
    queueMaxSize: 100
  }
  const v = { ...defaults, ...(p ?? {}) }

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
        checked={!!v.doOcr}
        onChange={(val) => setPrefs.mutate({ doOcr: val })}
      />
      <Row
        icon={ImageIcon}
        title="Şekilleri çıkar"
        desc="Görselleri ayıklar. Kapalı = %25-40 daha hızlı."
        checked={!!v.extractFigures}
        onChange={(val) => setPrefs.mutate({ extractFigures: val })}
      />
      <Row
        icon={Table}
        title="Tabloları algıla"
        desc="Tablo yapısını korur. Kapatırsan tablo → paragraf olur."
        checked={!!v.detectTables}
        onChange={(val) => setPrefs.mutate({ detectTables: val })}
      />
      <Row
        icon={Zap}
        title="Hızlı tablo modu"
        desc="FAST: %30-50 daha hızlı, ACCURATE: daha keskin."
        checked={!!v.fastTables}
        onChange={(val) => setPrefs.mutate({ fastTables: val })}
        disabledReason={!v.detectTables ? 'Önce “Tabloları algıla”yı aç' : null}
      />

      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="text-ql-12 text-muted-foreground hover:text-foreground mt-3 flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2"
      >
        <span className="flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5" /> Gelişmiş (25 ayar)
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {advancedOpen && (
        <div className="border-border/60 bg-muted/20 mt-3 space-y-4 rounded-xl border p-4">
          {/* OCR */}
          <div className="space-y-2">
            <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
              <ScanText className="h-3.5 w-3.5" /> OCR
            </p>
            <div className="space-y-1 pl-1">
              <label className="text-ql-12 flex items-center justify-between gap-2">
                <span>Dil (örn. en,tr — boş=otomatik)</span>
                <input
                  value={v.ocrLang}
                  onChange={(e) => setPrefs.mutate({ ocrLang: e.target.value })}
                  disabled={busy || !isInstalled}
                  placeholder="en,tr"
                  className="border-border bg-card text-ql-12 w-28 rounded-md border px-2 py-1"
                />
              </label>
              <Row
                icon={ScanText}
                title="Tam sayfa OCR'a zorla"
                desc="Her sayfayı OCR'la — çok yavaş, sadece taralı PDF'de aç."
                checked={!!v.forceFullPageOcr}
                onChange={(val) => setPrefs.mutate({ forceFullPageOcr: val })}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-ql-12">OCR batch</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={v.ocrBatchSize}
                  onChange={(e) => setPrefs.mutate({ ocrBatchSize: parseInt(e.target.value) || 4 })}
                  disabled={busy || !isInstalled}
                  className="border-border bg-card text-ql-12 w-20 rounded-md border px-2 py-1"
                />
              </div>
            </div>
          </div>

          {/* Enrichments */}
          <div className="space-y-2">
            <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
              <FlaskConical className="h-3.5 w-3.5" /> Zenginleştirmeler
            </p>
            <Row
              icon={Code}
              title="Kod anlama"
              desc="CodeItem dilini çıkarır."
              checked={!!v.doCodeEnrichment}
              onChange={(val) => setPrefs.mutate({ doCodeEnrichment: val })}
            />
            <Row
              icon={FlaskConical}
              title="Formül anlama"
              desc="LaTeX çıkarır."
              checked={!!v.doFormulaEnrichment}
              onChange={(val) => setPrefs.mutate({ doFormulaEnrichment: val })}
            />
            <Row
              icon={Layers}
              title="Resim sınıflandırma"
              desc="Şekil türünü etiketler."
              checked={!!v.doPictureClassification}
              onChange={(val) => setPrefs.mutate({ doPictureClassification: val })}
            />
            <Row
              icon={ImageIcon}
              title="Resim açıklama (VLM)"
              desc="Vizyon modeli ile caption — çok yavaş."
              checked={!!v.doPictureDescription}
              onChange={(val) => setPrefs.mutate({ doPictureDescription: val })}
            />
            <Row
              icon={ImageIcon}
              title="Grafik çıkarma"
              desc="Bar/pie → tablo/kod."
              checked={!!v.doChartExtraction}
              onChange={(val) => setPrefs.mutate({ doChartExtraction: val })}
            />
            <Row
              icon={Table}
              title="Hücre eşleştirme"
              desc="Tablo hücrelerini PDF hücreleriyle eşle."
              checked={!!v.cellMatching}
              onChange={(val) => setPrefs.mutate({ cellMatching: val })}
              disabledReason={!v.detectTables ? 'Tablo algılama kapalı' : null}
            />
          </div>

          {/* Görsel */}
          <div className="space-y-2">
            <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
              <ImageIcon className="h-3.5 w-3.5" /> Görsel
            </p>
            <Row
              icon={ImageIcon}
              title="Sayfa görselleri"
              desc="Her sayfanın raster'ı."
              checked={!!v.generatePageImages}
              onChange={(val) => setPrefs.mutate({ generatePageImages: val })}
            />
            <Row
              icon={ImageIcon}
              title="Tablo görselleri"
              desc="Tabloların görselini üret."
              checked={!!v.generateTableImages}
              onChange={(val) => setPrefs.mutate({ generateTableImages: val })}
            />
            <label className="text-ql-12 flex items-center justify-between gap-2">
              <span>Görsel scale ({v.imagesScale.toFixed(1)}x)</span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={v.imagesScale}
                onChange={(e) => setPrefs.mutate({ imagesScale: parseFloat(e.target.value) })}
                disabled={busy || !isInstalled}
                className="w-28"
              />
            </label>
          </div>

          {/* Sistem */}
          <div className="space-y-2">
            <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
              <Server className="h-3.5 w-3.5" /> Sistem
            </p>
            <Row
              icon={Server}
              title="Uzak servisler"
              desc="Bulut OCR/VLM — veri dışarı gider."
              checked={!!v.enableRemoteServices}
              onChange={(val) => setPrefs.mutate({ enableRemoteServices: val })}
            />
            <Row
              icon={Settings2}
              title="Harici eklentiler"
              desc="allow_external_plugins"
              checked={!!v.allowExternalPlugins}
              onChange={(val) => setPrefs.mutate({ allowExternalPlugins: val })}
            />
            <Row
              icon={FileSearch}
              title="Backend metni zorla"
              desc="force_backend_text"
              checked={!!v.forceBackendText}
              onChange={(val) => setPrefs.mutate({ forceBackendText: val })}
            />
            <Row
              icon={Layers}
              title="Başlık hiyerarşisi"
              desc="Bookmark/style ile h seviyesi."
              checked={!!v.enableHeadingHierarchy}
              onChange={(val) => setPrefs.mutate({ enableHeadingHierarchy: val })}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-ql-12 flex flex-col gap-1">
                <span>Device</span>
                <select
                  value={v.device}
                  onChange={(e) => setPrefs.mutate({ device: e.target.value })}
                  disabled={busy || !isInstalled}
                  className="border-border bg-card rounded-md border px-2 py-1"
                >
                  <option value="auto">auto</option>
                  <option value="cpu">cpu</option>
                  <option value="cuda">cuda</option>
                  <option value="mps">mps</option>
                </select>
              </label>
              <label className="text-ql-12 flex flex-col gap-1">
                <span>Thread</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={v.numThreads}
                  onChange={(e) => setPrefs.mutate({ numThreads: parseInt(e.target.value) || 4 })}
                  disabled={busy || !isInstalled}
                  className="border-border bg-card rounded-md border px-2 py-1"
                />
              </label>
              <label className="text-ql-12 flex flex-col gap-1">
                <span>Timeout (s, 0=yok)</span>
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={v.documentTimeout ?? 0}
                  onChange={(e) =>
                    setPrefs.mutate({ documentTimeout: parseInt(e.target.value) || null })
                  }
                  disabled={busy || !isInstalled}
                  className="border-border bg-card rounded-md border px-2 py-1"
                />
              </label>
              <label className="text-ql-12 flex flex-col gap-1">
                <span>Queue max</span>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={v.queueMaxSize}
                  onChange={(e) =>
                    setPrefs.mutate({ queueMaxSize: parseInt(e.target.value) || 100 })
                  }
                  disabled={busy || !isInstalled}
                  className="border-border bg-card rounded-md border px-2 py-1"
                />
              </label>
              <label className="text-ql-12 flex flex-col gap-1">
                <span>Layout batch</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={v.layoutBatchSize}
                  onChange={(e) =>
                    setPrefs.mutate({ layoutBatchSize: parseInt(e.target.value) || 4 })
                  }
                  disabled={busy || !isInstalled}
                  className="border-border bg-card rounded-md border px-2 py-1"
                />
              </label>
              <label className="text-ql-12 flex flex-col gap-1">
                <span>Table batch</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={v.tableBatchSize}
                  onChange={(e) =>
                    setPrefs.mutate({ tableBatchSize: parseInt(e.target.value) || 4 })
                  }
                  disabled={busy || !isInstalled}
                  className="border-border bg-card rounded-md border px-2 py-1"
                />
              </label>
            </div>
            <p className="text-ql-11 text-muted-foreground">
              Değişiklikler bir sonraki dönüşümde etkili olur, önbellek miss eder.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setPrefs.mutate({
                  doOcr: false,
                  ocrLang: '',
                  forceFullPageOcr: false,
                  detectTables: true,
                  fastTables: true,
                  cellMatching: true,
                  doCodeEnrichment: false,
                  doFormulaEnrichment: false,
                  doPictureClassification: false,
                  doPictureDescription: false,
                  extractFigures: false,
                  generatePageImages: false,
                  generateTableImages: false,
                  imagesScale: 1.0,
                  doChartExtraction: false,
                  forceBackendText: false,
                  enableRemoteServices: false,
                  allowExternalPlugins: false,
                  documentTimeout: null,
                  numThreads: 4,
                  device: 'auto',
                  enableHeadingHierarchy: false,
                  ocrBatchSize: 4,
                  layoutBatchSize: 4,
                  tableBatchSize: 4,
                  queueMaxSize: 100
                })
              }
              disabled={busy || !isInstalled}
              className="text-ql-12 border-border bg-card hover:bg-muted rounded-md border px-3 py-1.5"
            >
              Varsayılana dön
            </button>
            <span className="text-ql-11 text-muted-foreground self-center">25 ayar</span>
          </div>
        </div>
      )}
    </SurfaceCard>
  )
})

export default DoclingPipelineCard
