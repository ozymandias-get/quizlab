import type { ReaderFontFamily, ReaderTheme } from '@shared/stores/appearanceStore'

import type { TFunction } from 'i18next'
import { BookOpen, Columns, Minus, Palette, Text as LetterText, Type } from 'lucide-react'
import { memo } from 'react'

interface Props {
  readerFontFamily: ReaderFontFamily
  setReaderFontFamily: (v: ReaderFontFamily) => void
  readerLineHeight: number
  setReaderLineHeight: (v: number) => void
  readerParagraphGap: number
  setReaderParagraphGap: (v: number) => void
  readerMaxWidth: string
  setReaderMaxWidth: (v: string) => void
  readerLetterSpacing: string
  setReaderLetterSpacing: (v: string) => void
  readerTheme: ReaderTheme
  setReaderTheme: (v: ReaderTheme) => void
  t: TFunction
}

const FONT_OPTIONS: Array<{ value: ReaderFontFamily; label: string; desc: string }> = [
  { value: 'sans', label: 'Sans', desc: 'Inter — modern' },
  { value: 'serif', label: 'Serif', desc: 'Georgia — kitap' },
  { value: 'mono', label: 'Mono', desc: 'Monospace' },
  { value: 'dyslexic', label: 'OpenDyslexic', desc: 'Erişilebilir' }
]

const THEME_OPTIONS: Array<{ value: ReaderTheme; label: string; bg: string; fg: string }> = [
  { value: 'default', label: 'Varsayılan', bg: '#ffffff', fg: '#0a0a0a' },
  { value: 'sepia', label: 'Sepya', bg: '#f4ecd8', fg: '#5b4636' },
  { value: 'solarized', label: 'Solarized', bg: '#fdf6e3', fg: '#657b83' },
  { value: 'eink', label: 'E-Ink', bg: '#ffffff', fg: '#111111' },
  { value: 'highContrast', label: 'Yüksek Kontrast', bg: '#000000', fg: '#ffff00' }
]

const MAX_WIDTH_OPTIONS = [
  { value: '38rem', label: 'Dar (38rem)' },
  { value: '46rem', label: 'Orta (46rem)' },
  { value: '56rem', label: 'Geniş (56rem)' },
  { value: '72rem', label: 'Çok Geniş' }
]

const LETTER_SPACING_OPTIONS = [
  { value: '0em', label: 'Normal' },
  { value: '0.02em', label: 'Geniş' },
  { value: '0.04em', label: 'Çok Geniş' },
  { value: '-0.01em', label: 'Sıkı' }
]

const ReaderAppearanceSettings = memo(
  ({
    readerFontFamily,
    setReaderFontFamily,
    readerLineHeight,
    setReaderLineHeight,
    readerParagraphGap,
    setReaderParagraphGap,
    readerMaxWidth,
    setReaderMaxWidth,
    readerLetterSpacing,
    setReaderLetterSpacing,
    readerTheme,
    setReaderTheme,
    t
  }: Props) => {
    return (
      <div className="bg-card border-border space-y-5 rounded-xl border p-5">
        <div className="flex items-center gap-3">
          <div className="bg-muted border-border rounded-lg border p-2">
            <BookOpen className="text-muted-foreground h-4 w-4" />
          </div>
          <div>
            <h3 className="text-ql-13 font-bold">
              {t('reader_appearance_title', { defaultValue: 'Okuyucu Tipografi & Tema' })}
            </h3>
            <p className="text-ql-11 text-muted-foreground">
              {t('reader_appearance_desc', {
                defaultValue:
                  'Reader modu için yazı tipi, satır yüksekliği, kolon genişliği ve tema'
              })}
            </p>
          </div>
        </div>

        {/* Font family */}
        <div className="space-y-2">
          <label className="text-ql-12 flex items-center gap-1.5 font-semibold">
            <Type className="h-3.5 w-3.5" /> Yazı Tipi
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setReaderFontFamily(opt.value)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${readerFontFamily === opt.value ? 'border-primary bg-primary/10 ring-primary/20 ring-1' : 'border-border bg-muted/30 hover:bg-muted'}`}
              >
                <span className="text-ql-12 font-semibold">{opt.label}</span>
                <span className="text-muted-foreground block text-[11px]">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme palettes */}
        <div className="space-y-2">
          <label className="text-ql-12 flex items-center gap-1.5 font-semibold">
            <Palette className="h-3.5 w-3.5" /> Okuma Teması
          </label>
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-5">
            {THEME_OPTIONS.map((th) => (
              <button
                key={th.value}
                type="button"
                onClick={() => setReaderTheme(th.value)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${readerTheme === th.value ? 'border-primary ring-primary/30 ring-1' : 'border-border hover:bg-muted/40'}`}
                title={th.label}
                aria-pressed={readerTheme === th.value}
              >
                <span
                  className="block h-8 w-full rounded-md border"
                  style={{ background: th.bg, borderColor: th.fg + '30' }}
                />
                <span className="text-ql-11 font-medium">{th.label}</span>
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-ql-11">
            Sepya / Solarized / E-Ink modları göz yorgunluğunu azaltır; yüksek kontrast
            erişilebilirlik içindir.
          </p>
        </div>

        {/* Line height */}
        <div className="space-y-2">
          <label className="text-ql-12 font-semibold">
            Satır Yüksekliği: {(readerLineHeight ?? 1.7).toFixed(2)}
          </label>
          <input
            type="range"
            min={1.2}
            max={2.4}
            step={0.1}
            value={readerLineHeight ?? 1.7}
            onChange={(e) => setReaderLineHeight(parseFloat(e.target.value))}
            className="accent-primary w-full"
          />
          <div className="text-muted-foreground flex justify-between text-[11px]">
            <span>Sıkı</span>
            <span>Rahat</span>
          </div>
        </div>

        {/* Paragraph gap */}
        <div className="space-y-2">
          <label className="text-ql-12 flex items-center gap-1.5 font-semibold">
            <Minus className="h-3.5 w-3.5" /> Paragraf Aralığı:{' '}
            {(readerParagraphGap ?? 0.75).toFixed(2)}rem
          </label>
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.1}
            value={readerParagraphGap ?? 0.75}
            onChange={(e) => setReaderParagraphGap(parseFloat(e.target.value))}
            className="accent-primary w-full"
          />
        </div>

        {/* Max width */}
        <div className="space-y-2">
          <label className="text-ql-12 flex items-center gap-1.5 font-semibold">
            <Columns className="h-3.5 w-3.5" /> Maksimum Kolon Genişliği
          </label>
          <select
            value={readerMaxWidth}
            onChange={(e) => setReaderMaxWidth(e.target.value)}
            className="border-border bg-card text-ql-13 w-full rounded-lg border px-3 py-2"
          >
            {MAX_WIDTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Letter spacing */}
        <div className="space-y-2">
          <label className="text-ql-12 flex items-center gap-1.5 font-semibold">
            <LetterText className="h-3.5 w-3.5" /> Harf Aralığı
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {LETTER_SPACING_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setReaderLetterSpacing(o.value)}
                className={`rounded-lg border px-2 py-1.5 text-xs ${readerLetterSpacing === o.value ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }
)

ReaderAppearanceSettings.displayName = 'ReaderAppearanceSettings'
export default ReaderAppearanceSettings
