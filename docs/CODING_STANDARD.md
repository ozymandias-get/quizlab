# Quizlab Reader — Kodlama Standardı

> Bu doküman, `docs/ARCHITECTURE.md` ile birlikte okunmalıdır. Mimari sınırlar orada,
> bu dosya ise **günlük yazım kurallarını** ve kalite kapılarını tanımlar.

## 0. Amaç ve Kapsam

- Tüm `src/`, `electron/`, `shared/` (yani `@app`, `@features`, `@platform`, `@ui`, `@shared`, `@shared-core`, `@electron` alias'larının altı) için bağlayıcıdır.
- Test dosyaları (`__tests__/`, `*.test.*`, `*.spec.*`) bu standarda uyar; sadece test yazımına özel istisnalar ayrıca işaretlenir.
- "Mimari sınır" gereksinimleri `docs/ARCHITECTURE.md`'deki **Import Boundary Rules** ile birebir aynıdır; burada tekrar uygulama detayı verilmez.

## 1. Komut ve Kalite Kapıları (CI Gates)

Aşağıdaki komutlar her PR'da temiz geçmelidir. Hepsi `package.json` script'leridir.

| Amaç                | Komut                        | Kabul Kriteri                                      |
| ------------------- | ---------------------------- | -------------------------------------------------- |
| Format kontrolü     | `npm run format:check`       | Tüm kaynak dosyalar Prettier uyumlu.               |
| Lint                | `npm run lint`               | `--max-warnings=0` ile hatasız.                    |
| Tür denetimi        | `npm run typecheck`          | `tsc -b` hatasız (3 referans: app/node/node.test). |
| Test                | `npm test`                   | 241 dosya / 2285 test geçer.                       |
| Repo hijyeni        | `npm run ci:check-hygiene`   | `.cache`, `out.txt`, build artifact yok.           |
| Sürüm tutarlılığı   | `npm run ci:check-version`   | `package.json` ↔ `app/version` senkron.            |
| Bağımlılık denetimi | `npm run audit:high`         | Yüksek/critical CVE yok.                           |
| Dosya boyutu        | `npm run analyze:file-sizes` | Hook/component ≤ 250 satır, diğer ≤ 400 satır.     |
| CSS denetimi        | `npm run analyze:css`        | Stylelint kurallarına uygun.                       |

Yerel geliştirmede pre-commit hook (`.husky/pre-commit`) `format:check` + `lint` + `lint-staged` çalıştırır; büyük commit öncesi mutlaka `npm test` ve `npm run typecheck` da çalıştırılmalıdır.

## 2. TypeScript Kuralları

- `tsconfig` `strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`, `noUnusedParameters: true` ile gelir; bunlar bilinçli gevşetilmez.
- `any` **yasak**:
  - Üretim kodunda (`src/`, `electron/features/`, `electron/app/`, `electron/core/`, `shared/`) `any`, `as any`, `: any` kullanılmaz.
  - Tek bilinen istisna: Electron'un `<webview allowpopups=…>` JSX attribute'u. `string` değer geçerli, React'in `DetailedHTMLProps<HTMLAttributes>` tipi ise `boolean | undefined` üretir. Bu durumda `as any` cast'i **yanına açıklayıcı yorum** ile bırakılır (`src/features/ai/ui/AiSession.tsx`, `src/features/pdf/ui/components/GoogleDrivePanel.tsx`).
  - Üçüncü parti JSX augmentation yetersizse, augmentation'ı `src/shared/types/global.d.ts` içinde düzeltmek tercih edilir; cast ikinci tercihtir.
- `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `// @ts-expect-error` **yasak**; bir istisna zaten varsa üzerinde gerekçe + link olmalıdır.
- `any` tipi ESLint kuralı (`@typescript-eslint/no-explicit-any`) ile **error** seviyesinde engellenir. Bilinen istisnalar (Electron `<webview>`, logger shim) `eslint.config.mjs` içinde ayrıca tanımlanmıştır.
- `console.*` üretim kodunda **yasaktır** (`no-console` ESLint kuralı). Yalnızca `console.warn` ve `console.error`'a izin verilir. Test dosyaları, `scripts/` ve logger shim'leri istisnadır.
- Tip-only import'lar her zaman `import type { … }` ile yazılır; inline `import { type Foo }` yalnızca aynı modülden hem tip hem değer alınıyorsa kullanılır.
- Tip import'u `import { ensureErrorMessage } from '@shared/lib/errorUtils'` gibi çalıştırma yan etkisi olmayan saf fonksiyonlar için `unknown` parametreyle imzalanır; tüketicide `catch (err) { ensureErrorMessage(err, 'fallback') }` kalıbı kullanılır.

## 3. Import Sırası ve Alias Politikası

ESLint `no-restricted-imports` ile şunları zorunlu kılar:

- `@src/*` alias'ı yasak (`legacySrcAliasPattern`). Doğru alias: `@app`, `@features`, `@shared`, `@shared-core`, `@platform`, `@ui`, `@electron`.
- Renderer tarafı `electron` modülünü doğrudan import edemez; sadece `@platform/electron` üzerinden (`createBrowserElectronApi` / `useElectron*` hook'ları).
- `shared/` (cross-process) `electron` modülünü import edemez; `@electron/*` veya `electron` da yasak (uyarı).
- `@features/<x>/ui|model|api|hooks|lib` alt yolları **feature dışından** private. Dışarıdan erişim mutlaka `@features/<x>` barrel'ı üzerinden olur.

**Import sırası (`eslint-plugin-simple-import-sort` ile otomatik):**

`npm run lint --fix` çalıştırıldığında import'lar aşağıdaki sıraya göre otomatik düzenlenir:

1. `"^\0"` — yan etki import'ları (side-effect imports)
2. `"^node:"` — Node.js standart kütüphanesi
3. `"^@shared-core"` — cross-process tipler/sabitler
4. `"^@electron"`, `"^@platform"` — platform katmanı
5. `"^@features"` — feature barrel'ları
6. `"^@(app\|ui\|shared)"` — app shell, UI, shared yardımcılar
7. `"^@?\\w"` — üçüncü parti paketler
8. `"^\\.\\.", "^\\.\\."` — göreceli import'lar (ebeveyn, aynı dizin)

Her grup içinde import'lar alfabetik sıralanır. Test dosyalarında (`__tests__/`, `*.test.*`, `*.spec.*`) `vi.mock` hoisting sorunları nedeniyle bu kural devre dışıdır. Test dosyalarında import grupları arasında boş satır bırakılmamalıdır.

## 4. Feature Mimari Kuralları (Özet)

- Her feature'ın `index.ts` barrel'ı **tek** public yüzeydir. Dış tüketiciler sadece buradan import alır.
- Bir feature, başka bir feature'ın **barrel'ından** import alabilir; başka feature'ın alt klasörüne (`@features/y/lib/...`, `@features/y/ui/...` vs.) doğrudan erişemez.
- Cross-feature ihtiyaç: ya hedef feature'a yeni bir barrel export'u eklenir, ya da paylaşılan mantık `@shared/lib` veya `@shared-core/types` altına taşınır.
- `src/features/<x>/ui`, `model`, `api`, `hooks`, `lib` klasörleri feature içindeki katmanlardır. Testler bu klasörlere girip derinlemesine import alabilir; üretim kodu ise sadece barrel üzerinden dışarı çıkar.
- Feature içi cross-import istisnası: `ui/components/pdfPlaceholder/types.ts` gibi yeniden dışa aktarım (re-export) amaçlı ince barrel'lar kabul edilir, ancak ana barrel'ın (`@features/<x>`) hâlâ tüm tipleri dışa aktarması esastır.

## 5. Naming Conventions

| Varlık                     | Kural                                                                                                 | Örnek                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| React component            | `PascalCase`                                                                                          | `PdfViewer`, `AiSendComposer`                      |
| Hook                       | `useCamelCase`                                                                                        | `useAiSender`, `usePdfTabStore`                    |
| Store (Zustand)            | `use<Feature>Store` (veya `useApiChatStore`)                                                          | `useApiChatStore`                                  |
| Provider/Context hook      | `use<Context>`, context value `use<Context>Value`                                                     | `useToastActions`, `useLanguage`                   |
| Service/Handler            | `register<Domain>Handlers` (electron), `use<Domain>Api` (renderer)                                    | `registerAiConfigHandlers`, `useAiApi`             |
| Sabitler (modül düzeyinde) | `SCREAMING_SNAKE_CASE`                                                                                | `STORAGE_KEYS`, `IPC_CHANNELS`, `PDF_ZOOM_STEP`    |
| Tür (type/interface)       | `PascalCase`, `I` prefix'i YOK                                                                        | `AiConfig`, `PdfTab` (✅), `IAiConfig` (❌)        |
| Enum/Union sabitleri       | `PascalCase` string union                                                                             | `SubmitMode = 'mixed' \| 'enter' \| 'send-button'` |
| Dosya adı                  | Component = `PascalCase.tsx`, hook/lib = `camelCase.ts`                                               | `useAiSender.ts`, `parseMessageContent.ts`         |
| Genel isimlerden kaçın     | `data`, `value`, `item`, `temp`, `tmp`, `result`, `handler`, `utils`, `helpers` tek başına isim olmaz | `aiRegistry`, `selectionColor`, `sessionConfig` ✅ |

- `utils/` veya `helpers/` adlı klasör **önerilmez**; bunun yerine `<domain>Utils.ts` veya doğrudan `<feature>/lib/<concern>.ts` adlandırması yapılır (örn. `electron/features/automation/utils/dom/` yerine `electron/features/automation/dom/` veya `@shared/lib/dom.ts` hedeflenir).
- `handler` adı tek başına yasak değildir; ama bir IPC handler'ı adlandırırken **kaynak/tür** belirtilir: `aiConfigHandlers.ts`, `pdfHandlers.ts` ✅; `handlers.ts` (tek başına) ❌.
- Test dosyaları `<konu>.test.ts(x)` veya `<konu>.test-helpers.ts(x)` (yardımcı paylaşılan test kodu için) kalıbını izler.
- **Boolean değişkenler** `is`, `has`, `can`, `should` ile başlar: `isOpen`, `hasPermission`, `canSubmit`, `shouldRetry` ✅; `open`, `permission`, `submit`, `retry` ❌.
- **Event handler'lar** `handleAction` formatında olur: `handlePageSettled`, `handleConfigSave`, `handleZoomIn` ✅; `pageSettled`, `configSave`, `zoomIn` ❌ (handler olmadığında serbest).

### Fonksiyon Bildirim Stili

Tutarlılık için proje genelinde tek stil tercih edilir:

- **Export edilen fonksiyonlar**: `export function name()` — function declaration kullanılır. Arrow function only tek satırlık basit getter/setter'larda kabul edilir (örn. `export const getFoo = () => foo`).
- **Export edilmeyen iç fonksiyonlar**: `function name()` veya `const name = () => {}` serbesttir; ama aynı dosya içinde tutarlı olunur.
- **Aynı dosyada karışık stil yasak**: Bir dosyada tüm export'lar `function` veya tümü `const arrow` olur. İkisi birden aynı dosyada kullanılmaz.

### Import Path Politikası (Alias vs Göreceli)

Electron ana süreci (`electron/`) ve `shared/` dosyalarında import yolu stratejisi:

- **`shared/` (cross-process)**: Alias kullanmaz; göreceli yol ile import yapılır (örn. `../constants/ipc-channels`). `@shared-core/*` alias'ı **yalnızca renderer tarafında** kullanılır.
- **`electron/`**: Ayni mantık — `../../shared/...` göreceli yollar tercih edilir. Ancak `@shared-core/types` gibi type-only importlarda alias da kabul edilir (mevcut kodda her iki stil de mevcuttur; bir dosya içinde tutarlı olunması yeterlidir).
- **`src/` (renderer)**: Alias zorunludur; göreceli import yalnızca aynı feature/modül içindedir.

### Sabit Obje Tanımları (`as const`)

Modül düzeyindeki sabit nesneler **her zaman** `as const` ile tanımlanır:

```ts
// ✅ Doğru — literal type inference sağlar
export const IPC_CHANNELS = { SELECT_PDF: 'select-pdf', ... } as const

// ❌ Yanlış — string olarak inference edilir
export const IPC_CHANNELS = { SELECT_PDF: 'select-pdf', ... }
```

Bu kural `STORAGE_KEYS`, `IPC_CHANNELS`, `SCREENSHOT_TYPES`, `APP_CONFIG` gibi tüm sabit nesneleri kapsar. `as const` yalnızca compile-time etkiye sahiptir; runtime davranışını değiştirmez.

## 6. Component Kuralları

- Componentler **fonksiyonel** olur; default export tercih edilir, adlandırılmış export sadece barrel'a yönlendirme içindir.
- `memo(...)` sadece:
  1. Aynı referansla alt component'e geçirilen prop paketleri (örn. `resizeHandlers`),
  2. Kanıtlanmış re-render pahalılığı (büyük DOM ağacı, animasyon, webview ref'i) için kullanılır.
  - "Her ihtimale karşı" `memo` yasak; PR review'da gerekçe yorumu aranır.
- `useMemo`/`useCallback` benzer şekilde: ya gerçek bir referans stabilizasyonu (memo'lu alt component, dependency array'i olan effect) ya da gerçek bir hesap pahalılığı. Aksi halde yazılmaz.
- `useEffect` kullanımı:
  - Bağımlılık dizisi **her zaman açıkça** yazılır; boş `[]` yalnızca mount/unmount effect'leri içindir.
  - Effect içinden `setState` zinciri yalnızca event→state→effect akışını zorunlu kıldığında kullanılır; doğrudan olay işleyicisinde çağrılabilir mi diye önce düşünülür.
  - Cleanup fonksiyonu: listener, interval, observer, AbortController, timeout, Promise iptali — her biri için yazılır.
  - "İçeride asla `useMemo`, `useRef`, `useEffect` taşıma" gibi **küresel yasaklar** yorum olarak bırakılmaz; mimari kararsa koda yansır (`src/features/pdf/ui/hooks/usePdfPlugins.ts:57` örneği, kabul edilebilir tek örnek).
- Render sırasında yan etki yasak: `fetch`, `localStorage.setItem`, `Date.now()`-kritik zaman damgası gibi şeyler effect veya olay işleyicisine taşınır.

## 7. Hook Kuralları

- Hook isimleri `use` ile başlar; React hook'ları sadece React component veya başka hook içinden çağrılır.
- Hook parametreleri: tek options objesi (>= 3 alan varsa) veya sıralı zorunlu argümanlar (<= 2 zorunlu alan). Karışım önerilmez.
- Hook dönüş tipi: ya primitive/obj değer, ya `(value, …handlers)` tuple. Çok uzun obje döndüren hook'lar bölünür.
- TanStack Query hook'ları `useElectronQuery` / `useElectronMutation` (`src/platform/electron/useElectron.ts`) üzerinden yazılır:
  - Hata mesajı `errorMessage` opsiyonu ile i18n'li verilir.
  - `showErrorToast: false` yalnızca tüketicinin kendine özgü hata mesajı göstermesi gerektiğinde kullanılır (`useSaveAiConfig({ suppressErrorToast: true })`).
  - Domain-spesifik başarı toast'ı ihtiyaç varsa mutation `onSuccess`'inde `useToastActions().showSuccess` + `t('…')` ile tetiklenir.

## 8. State Yönetimi

- **Yerel state**: `useState`, `useReducer`.
- **Cross-component state (renderer)**: Zustand store; feature içinde `src/features/<x>/store/`, app düzeyinde `src/app/providers/<x>/`.
- **Server state**: TanStack Query (`@tanstack/react-query`); mutasyon/hook sarmalayıcıları yalnızca `@platform/electron/api` altında.
- **Cross-process state**: `@shared-core/types` içindeki tipler + IPC contract (`shared/types/ipcContract.ts` + `IpcInvokeRequestMap`).
- Persist gereken store'larda `persist` + `partialize` + `version` + `migrate` kalıbı kullanılır; `localStorage` doğrudan yazılmaz, `useLocalStorage` (`src/shared/hooks/useLocalStorage.ts`) veya store persist tercih edilir.

## 9. Service / IPC Layer (Electron)

- Her domain için tek handler dosyası: `electron/features/<x>/<x>Handlers.ts` (örn. `aiConfigHandlers.ts`, `pdfHandlers.ts`).
- `electron/app/ipcHandlers.ts` aggregator'ı tüm handler'ları tek noktada `ipcMain.handle(...)` ile bağlar. **Ek `ipcMain.handle/on` çağrıları doğrudan handler dosyalarında yapılmaz.**
- Her handler'da:
  1. `requireTrustedIpcSender(event)` ilk satır olarak (`electron/core/ipcSecurity.ts`). **Bu kural `ipcMain.handle` VE `ipcMain.on` handler'ları için geçerlidir.** `ipcMain.on` handler'larında `event` tipi `IpcMainInvokeEvent` değil `IpcMainInvokeEvent`'e benzer; `as never` cast'i ile `requireTrustedIpcSender` çağrılabilir (bkz. `pdfHandlers.ts`).
  2. Payload doğrulaması: `ipcPayloadGuards.ts` (`toStrictBoolean`, vb.) veya feature içi `sanitize*` (`aiConfigSanitize.ts` örnek kalıbı).
  3. Hata: `Logger.error` + IPC tarafında `throw new Error('user_message_key')` veya `result` discriminated union.
  4. `Logger.error` kullanımı (henüz `console.error` kalan yerler için de hedef).

- Renderer tarafı: her domain için `src/platform/electron/api/use<Domain>Api.ts`. Asla doğrudan `window.electronAPI` çağrısı yapılmaz; `useElectron*` üzerinden.
- Preload'da API exposure: `electron/preload/index.ts`; her yeni IPC kanalı için `shared/types/ipcContract.ts` + `shared/constants/ipc-channels.ts` + `shared/types/ipc.ts` üçlüsü birlikte güncellenir (tek sözleşme kaynağı).

## 10. Error Handling

- **Catch parametresi `unknown`** olur; `catch (err: any)` yasak.
  - Mesaj çıkarmak için `ensureErrorMessage(err, fallbackKey)` (`@shared/lib/errorUtils`) kullanılır.
  - Tek satırlık inline erişimde `err instanceof Error ? err.message : '…'` kalıbı da kabul edilir.
- **Bilerek yutulan hata** üç kalıptan biriyle yazılır:
  1. `try { … } catch (err) { reportSuppressedError('scope.tag', { cause: err }) }` — issue-report buffer'a düşer.
  2. `try { … } catch { /* expected: … */ }` — yanına **açıklayıcı tek satır yorum**.
  3. `try { … } catch { Logger.debug('…') }` — yalnızca selector engine / `MutationObserver.disconnect()` gibi tarayıcı API'lerinin "expected to throw" senaryolarında.
- **Kullanıcıya gösterilecek hata**:
  - Toast: `useToastActions().showError(key)` + `errorMessage`/`title` opsiyonu (i18n).
  - Inline alan: form / picker gibi yerlerde kendi mesajı, `useSaveAiConfig({ suppressErrorToast: true })` kalıbı.
- Renderer'da `console.error` doğrudan çağrılmaz; `Logger.error` kullanılır (issue buffer'a yazar).

## 11. Logging (Logger)

- `@shared/lib/logger.ts` içindeki `Logger.{info,warn,error}` her yerde tercih edilir.
- `console.*` kullanımı:
  - Test dosyalarında (geçici spy amaçlı) serbesttir.
  - Üretim kodunda **yasak** (electron handler'ları, renderer component'leri, i18n, vs.).
  - **Bilinen istisna**: `src/shared/i18n/locales/_index.ts:126` — geliştirme zamanı i18n çakışma uyarısı, `process.env.NODE_ENV !== 'production'` ile zaten korunur. Kalıcı istisna olarak bu standartta kayıtlıdır; başka yerlerde benzer kalıp eklenirse aynı dev-gate zorunludur.
- Electron ana sürecinde `Logger` (`electron/core/logger.ts`) zorunludur. Bu, `src/shared/lib/logger.ts` API'sini birebir yansıtan bir shim'dir (sebep: TypeScript project reference sınırı — renderer `app` projesinde, electron `node`/`node.test` projelerinde değil).
  - Yeni hata yolları `Logger.warn` / `Logger.error` / `Logger.info` ile yazılır.
  - `reportSuppressedError` de aynı shim'den import edilir.
  - **Göç hedefi**: `src/shared/lib/logger.ts` ile `electron/core/logger.ts` birleştirilip `shared/lib/logger.ts` (cross-process) konumuna taşınacak. Bu yapıldığında import path'leri tek seferde güncellenir; API değişmez.
  - `console.*` üretim kodunda **yalnızca** `electron/core/logger.ts` içinde kullanılabilir (shim tanımı). Diğer tüm electron dosyaları `Logger` kullanır.

## 12. Async / Promise Kuralları

- Zincir `.then().then().catch()` yerine her zaman `async/await` tercih edilir.
- Zorunlu olmadıkça fire-and-forget `void promise` yapılmaz; edilirse `.catch(Logger.error)` veya `reportSuppressedError` ile bağlanır.
- İptal/abort gerekli yerlerde `AbortController` + `AbortSignal` kullanılır; 60 sn gibi timeout'lar hard-coded değil, sabittir (`@shared/constants` veya `aiSenderSupport.ts` içindeki modül sabitleri).
- `Promise.all` paralel, `Promise.allSettled` "bazıları başarısız olsa da devam et" senaryolarında; aralarında seçim gerekçe yorumu ile yazılır.

## 13. Stil ve UI Kuralları

- **Tailwind utility class** her zaman önceliklidir. `style={{ ... }}` yalnızca:
  1. Dinamik renk/konum (color picker, webview dock konumu, canvas animasyonu).
  2. `data-*` attribute ile conditional style geçişi.
  3. Üçüncü parti bileşenin (örn. PDF viewer plugin) iç API'sinin zorunlu kıldığı durum.
  - Bu üçü dışında `style` attribute'u PR review'da geri çevrilir.
- Renk paleti: `tailwind.config.js` içindeki `sand` ve `stone` paletleri. Yeni renk eklenirse palete eklenir, hex literal JSX/CSS içinde yazılmaz.
- `cn(...)` her zaman `@shared/lib/uiUtils`'tan alınır; `clsx`/`classnames` doğrudan kullanılmaz.
- Tailwind utility class'ları `prettier-plugin-tailwindcss` ile otomatik sıralanır (`npm run format`). `w-4 h-4` yerine `h-4 w-4` şeklinde düzenlenir.
- CSS dosyaları `npm run analyze:css` (Stylelint) ile denetlenir. `.stylelintrc.json` yapılandırması projenin mevcut CSS kod stiline uyumludur.
- `framer-motion` (`motion`) kullanımı: `prefers-reduced-motion` kontrolü `src/shared/hooks` veya ilgili component'te sağlanır.
- Erişilebilirlik: interaktif elementlerde `aria-*`, `role`, klavye etkileşimi, odak halkası zorunludur; `react/no-danger` ESLint kuralı warn seviyesindedir, üretim kodu `dangerouslySetInnerHTML` ile yazmaz.

### CSS Token Sistemi

Proje, Tailwind v4 `@theme` ile tanımlanmış merkezi bir token sistemine sahiptir.

**Z-index tokenları** (`src/shared/styles/index.css`):
| Token | Değer | Kullanım |
|-------|-------|----------|
| `--z-negative-10` | -10 | Ambient arkaplan katmanı |
| `--z-negative-2` / `--z-negative-1` | -2 / -1 | Glow / panel gölge katmanları |
| `--z-pdf-overlay` / `--z-pdf-overlay-top` | 10 / 11 | PDF görüntüleyici overlay'leri |
| `--z-resizer-hub` | 40 | Panel resizer hub |
| `--z-dropdown` → `--z-max` | 100 → 2147483647 | Standart z-index skalası |

`@utility` sınıfları: `z-negative-10`, `z-negative-2`, `z-negative-1`, `z-pdf-overlay`, `z-pdf-overlay-top`, `z-resizer-hub`, `z-dropdown`, `z-overlay`, `z-modal`, `z-toast`, `z-tooltip`, `z-top`, `z-max`

**Transition süre tokenları:**
| Token | Süre | Kullanım |
|-------|------|----------|
| `--duration-instant` | 0ms | Anlık |
| `--duration-fast` | 100ms | Çok hızlı geçişler |
| `--duration-normal` | 150ms | Standart hover/geçiş |
| `--duration-slow` | 200ms | Panel açılışları |
| `--duration-slower` | 300ms | Opacity geçişleri |
| `--duration-deliberate` | 500ms | Belirgin animasyonlar |
| `--duration-slowest` | 900ms | Uzun animasyonlar |

`@utility` sınıfları: `motion-instant`, `motion-fast`, `motion-normal`, `motion-slow`, `motion-slower`, `motion-deliberate`, `motion-slowest`

**Gölge sistemi:**
| Token | CSS değeri |
|-------|-----------|
| `--shadow-glass-sm` | `rgba(0, 0, 0, 0.4)` |
| `--shadow-glass-md` | `rgba(0, 0, 0, 0.75)` |
| `--shadow-ambient-sm` | `0 1px 2px var(--shadow-glass-sm)` |
| `--shadow-ambient-md` | `0 1px 2px var(--shadow-glass-sm), 0 24px 48px -12px var(--shadow-glass-md)` |

`@utility` sınıfları: `shadow-ambient-sm`, `shadow-ambient-md`, `shadow-ambient-lg`, `shadow-ambient-xl`

**Kaydırma çubuğu renk tokenları:**

- `--color-scrollbar-thumb`: Scrollbar thumb rengi (light/dark uyumlu)
- `--color-scrollbar-thumb-hover`: Hover durumu

**Motion variantları (Tailwind v4):**

- `motion-ok:` — `prefers-reduced-motion: no-preference` için conditional variant
- `motion-not:` — `prefers-reduced-motion: reduce` için conditional variant
  Kullanım: `<div class="motion-ok:opacity-100 motion-not:opacity-0">`

**Responsive breakpoint tokenları** (`@custom-media`):

- `--viewport-sm`: max-width 768px
- `--viewport-md`: max-width 1024px
- `--viewport-lg`: max-width 1280px

Kullanım (CSS): `@media (--viewport-md) { ... }`

### Yazım Kuralları

1. Yeni CSS değerleri eklerken önce mevcut token'ları kontrol edin
2. Hardcoded `rgba()` / `hsla()` yerine token kullanın
3. Z-index değerleri için asla magic number kullanmayın, `var(--z-*)` veya `z-*` utility sınıflarını tercih edin
4. Transition süreleri için `var(--duration-*)` kullanın
5. Yeni CSS dosyaları eklerken `src/shared/styles/modules/` altında `_` prefix ile ekleyin ve `index.css`'e `@import` edin

## 14. Test Kuralları

- Vitest (`npm test`) ana test runner'ıdır; jsdom ortamı.
- Konum: `src/__tests__/...` (paylaşılan test kodu) ve `<source>/__tests__/...` (kolokasyon). Testler kaynak dosyaya bitişik tutulur.
- Test factory'leri `src/__tests__/helpers/factories.ts` içinde; render helper'ları `src/__tests__/helpers/render-helpers.tsx` içinde.
- `useElectronQuery`/`useElectronMutation` testlerinde `getElectronApi` mock'u `src/__tests__/helpers/render-helpers.tsx` üzerinden sağlanır.
- Coverage threshold'ları `vitest.config.mts`'te tanımlıdır: global `52/50/45/42`, feature bazlı override'lar (örn. `gemini-web-session 58/55`, `pdf 43/41`, `automation 65/63`). Bu eşikler bilinçli olarak aşağı çekilmez; yeni feature için eşik eklenir.
- IPC contract testi (`electron/__tests__/core/ipcContract.test.ts`) **tip düzeyinde** sözleşmeyi doğrular; yeni IPC kanalı eklenirken bu teste de karşılık düşen vaka eklenir.
- Testlerde `any` kabul edilebilir; ancak test edilen davranışın asıl dış yüzeyini (public API) test etmek tercih edilir. İç implementasyon detayına bağlanan testler kırılgan kabul edilir.

### Test Dosyası İsimlendirme

- `describe` blokları **davranış odaklı** olur; implementation detail içermmez.
- Üst düzey `describe`: `<ModülAdı>` (sadece modül adı, "Component" veya "Hooks" eki eklemez).
- İç `describe`'ler: gruplama için kullanılır (`'with empty state'`, `'when user clicks save'`).
- `it`/`test` isimleri **davranış belirtir**: `it('renders nothing when closed')`, `it('saves config on submit')`.

```ts
// ✅ Doğru
describe('useLocalStorage', () => {
  describe('with string values', () => {
    it('returns initial value when storage is empty', () => { ... })
    it('updates value when setter is called', () => { ... })
  })
})

// ❌ Yanlış
describe('useLocalStorage Hooks', () => {
  it('should return initial value when storage is empty', () => { ... })
})
```

### Test Yardımcıları (Single Import Point)

Tüm test yardımcıları `src/__tests__/helpers/render-helpers.tsx` üzerinden tek noktadan import edilir:

```ts
// ✅ Doğru — tek dosyadan tüm yardımcılar
import {
  renderWithProviders,
  tMock,
  defaultLanguageMock,
  fireStorageEvent,
  fireLocalStorageSyncEvent
} from '../helpers/render-helpers'

// ❌ Yanlış — ayrı dosyalardan import (halen çalışır ama tercih edilmez)
import { tMock } from '../helpers/test-utils'
```

`test-utils.tsx` içindeki yardımcılar `render-helpers.tsx` üzerinden re-export edilir; bu dosya tek gerçek giriş noktasıdır.

## 15. Dosya / Modül Organizasyonu

- Bir dosya 400 satırı aştığında bölünür. Hook/component dosyaları 250 satır civarı "rahat" üst sınırdır; aşılırsa bölünür.
- Bu kural `npm run analyze:file-sizes` ile denetlenir; CI pipeline'de `scripts/check-file-sizes.mjs` çalışır.
- Bir modül **tek bir sorumluluğa** sahip olur; "util-collection" modülleri (`utils.ts`, `helpers.ts`, `common.ts`) yasak.
- Re-export amaçlı `types.ts` veya `public.ts` gibi ince barrel'lar kabul edilir; ancak ana barrel her zaman tek gerçek kaynaktır.
- `index.ts` barrel'ları sadece export içerir; default export re-export etmez, yorum/JSdoc dışında başka şey barındırmaz.

## 16. Güvenlik ve Sözleşme (Özet)

- Renderer hiçbir zaman `nodeIntegration`, `contextIsolation=false`, `webSecurity=false` ile yüklenmez (`electron/app/window/security.ts`).
- Her IPC handler `requireTrustedIpcSender(event)` ile başlar.
- Kullanıcıdan gelen HTML/metin render edilmeden önce `sanitize*` veya `DOMPurify` benzeri geçitten geçirilir (`tutorial` HTML ipuçları gibi).
- API anahtarları kod içinde, logda, versiyon kontrolünde **olmaz**; IPC üzerinden main süreçte tutulur, renderer'a geri dönmez.
- Dependency audit: `npm run audit:high` her PR'da temizdir.

## 17. Performans Kuralları

- **N+1 sorgu**: Listeleme component'leri her satır için tek tek IPC çağırmaz; toplu çağrı + `useQuery` ile cache.
- **Pagination**: Liste endpoint'leri (varsa) sayfalı; ileride tüm liste gerekiyorsa limit + cursor sözleşmesi.
- **Senkron engelleyen iş**: 50 ms+ süren her şey `async` veya web worker.
- **Re-render**: parent memo'su olmadan tüketilen prop paketleri ya düz primitive olur ya context üzerinden paylaşılır.
- **Lazy load**: route-level componentler `lazy(() => import('@features/...'))` ile yüklenir; pre-warm `useBottomBarController` gibi yerlerde `scheduleIdlePrefetch` ile yapılır.

## 18. Sürüm ve Süreç

- Conventional Commit zorunludur. Commit mesajı `type(scope): description` formatında olur. `commitlint` (`.husky/commit-msg` hook) ile denetlenir. İzin verilen tipler: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `revert`.
- PR review checklist:
  1. `npm run format:check && npm run lint && npm run typecheck && npm test && npm run analyze:file-sizes && npm run analyze:css` hepsi yeşil.
  2. Mimari sınır ihlali yok (`@features/<x>/<private>` dışarıdan import edilmiyor, vb.).
  3. `console.*`, `any`, `as any`, `// eslint-disable` ESLint tarafından engellenir (bilinen istisnalar yoksa).
  4. Yeni IPC kanalı `shared/types/ipcContract.ts` + `shared/constants/ipc-channels.ts` + `shared/types/ipc.ts` üçlüsünde tanımlı; preload + handler + renderer hook güncel.
  5. Coverage eşiği korunuyor.
  6. Dokümantasyon: yeni bir feature/servise dair barrel değiştiyse bu dosya güncellenir.
- Versiyon tutarlılığı: `package.json` ↔ `app/version.ts` ↔ release tag (`npm run ci:check-version`).

## 19. Geliştirme Ortamı (VS Code)

Proje kökünde `.vscode/settings.json` ve `.vscode/extensions.json` dosyaları bulunur. Önerilen eklentiler:

- **ESLint** — flat config desteği ile, kaydetmede otomatik düzeltme
- **Prettier** — varsayılan formatör, Tailwind class sıralama dahil
- **Stylelint** — CSS denetimi
- **Tailwind CSS IntelliSense** — class tamamlama ve imzalı önizleme
- **ES7+ React snippets**
- **GitHub Actions**

`settings.json` ile formatOnSave, eslint --fix, stylelint fix, Tailwind CSS class regex ve dosya ilişkilendirmeleri otomatik olarak yapılandırılmıştır.

---

## Bilinen ve Kalıcı İstisnalar

| Konum                                                    | İstisna                                                                                   | Gerekçe                                                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/ai/ui/AiSession.tsx:198`                   | `allowpopups={… as any}` + açıklayıcı yorum                                               | Electron `<webview>` JSX attribute tip uyumsuzluğu (React `boolean` vs Electron `string`). Augmentasyon denendi; yetersiz kaldı.                                       |
| `src/features/pdf/ui/components/GoogleDrivePanel.tsx:60` | Aynı kalıp                                                                                | Aynı.                                                                                                                                                                  |
| `src/shared/i18n/locales/_index.ts:126`                  | `console.warn` (dev-only, `NODE_ENV !== 'production'` gate'li)                            | Geliştiriciye i18n çakışmasını **hemen** göstermek; `Logger.warn` sadece buffer'a yazıp prod'da logu basmaz, oysa bu uyarı kullanıcıya değil geliştiriciye yöneliktir. |
| `src/features/pdf/ui/hooks/usePdfPlugins.ts:57`          | Effect bağımlılıklarında "asla `useMemo`/`useRef`/`useEffect` içine taşıma" kalıcı yorumu | PDF plugin init sırası nedeniyle bilinçli mimari karar; yorum silinirse plugin init sırası bozulur.                                                                    |
| `src/features/automation/automationScripts/helpers/*`    | `try { … } catch { /* expected */ }` veya boş catch                                       | Tarayıcı otomasyonu sırasında `disconnect`, `removeEventListener`, selector sorgusu başarısızlıkları "expected" kabul edilir.                                          |
| `electron/core/logger.ts`, `src/shared/lib/logger.ts`    | `console.*` ve `any` kullanımı                                                            | Logger shim'in kendisi — `console` ve `any` zorunlu.                                                                                                                   |
| `src/shared/i18n/locales/_index.ts`                      | `console.warn` (dev-only)                                                                 | Geliştiriciye i18n çakışmasını göstermek; `Logger.warn` prod'da logu basmaz. (ESLint `no-console` istisnası)                                                           |
| `electron/app/index.ts`                                  | `any` kullanımı                                                                           | Electron IPC start-up tiplendirmesi için.                                                                                                                              |
| `src/app/components/ui/sparkles.tsx`                     | `any` kullanımı                                                                           | Üçüncü parti particle kütüphanesi tip uyumsuzluğu.                                                                                                                     |
| `src/features/ai/lib/aiSenderSupport.ts`                 | `any` kullanımı                                                                           | Karmaşık send pipeline tip bağlayıcı.                                                                                                                                  |
| `scripts/**`                                             | `console.*` kullanımı                                                                     | Build/development script'leri — üretim kodu değil.                                                                                                                     |

Bu istisnalar dışındaki tüm ihlaller PR review'da geri çevrilir.
