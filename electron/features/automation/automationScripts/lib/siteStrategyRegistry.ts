/**
 * Site Strategy Registry
 * Önceki tasarımda (selectorEngine.ts):
 *   - tryClaudeStrategy, tryDeepSeekStrategy, tryQwenStrategy, tryKimiStrategy
 *     hostname includes() karşılaştırmasıyla çağrılıyordu.
 *   - Yeni site eklemek için selectorEngine.ts'yi düzenlemek gerekiyordu.
 *   - Sıralama statik: yalnızca hostname eşleşirse çalışıyordu; site farklı
 *     bir hostname altında (ör. sohbet.bar.com) kendi davranışını kaybediyordu.
 *
 * Yeni tasarım:
 *   - Site stratejileri bir registry'ye kayıtlı fonksiyonlardır.
 *   - Her strateji hem bir "match" (hostname testi) hem de bir "produce" (selector
 *     üret) fonksiyonu içerir.
 *   - Yeni strateji eklemek tek satırdır: `registerSiteStrategy({...})`.
 *   - Stratejiler, runtime'da da (kullanıcı-eklentili) eklenebilir — `tryProviderStrategy`
 *     seçim mantığı en yüksek "öncelik" sırasına göre ilerler.
 */

type SiteStrategyKind = 'input' | 'button'

interface SiteStrategyMatch {
  /**
   * Hostname eşleştirici. Sıralı `includes()` mantığı.
   * Birden fazla kelime içeriyorsa (ör. ['claude', 'anthropic']) tümü aranır.
   */
  hostPatterns: string[]
  /**
   * Daha yüksek sayı = daha yüksek öncelik. Eşleşen birden fazla strateji varsa
   * en yüksek öncelik kazanır. Varsayılan 0.
   */
  priority?: number
}

interface SiteStrategyCandidate {
  element: Element
  matchedSelector: string
  strategy: 'provider'
}

type SiteStrategyProduce = (kind: SiteStrategyKind) => SiteStrategyCandidate | null

interface SiteStrategy {
  /** Stratejinin benzersiz kimliği (log + diagnostics) */
  id: string
  match: SiteStrategyMatch
  produce: SiteStrategyProduce
}

const registeredStrategies: SiteStrategy[] = []

/**
 * Yeni bir site stratejisi kayıt eder.
 * Daha önce aynı `id` ile kayıt yapılmışsa üzerine yazılır.
 */
export function registerSiteStrategy(strategy: SiteStrategy): void {
  const existingIndex = registeredStrategies.findIndex((s) => s.id === strategy.id)
  if (existingIndex >= 0) {
    registeredStrategies[existingIndex] = strategy
  } else {
    registeredStrategies.push(strategy)
  }
}

/**
 * Tüm kayıtlı stratejilerin salt-okunur bir kopyasını döner (test ve snapshot için).
 */
export function getRegisteredStrategies(): ReadonlyArray<SiteStrategy> {
  return [...registeredStrategies]
}

/**
 * Test ortamlarında state'i temizlemek için. Hem kayıtlı stratejileri hem
 * de "builtinsRegistered" bayrağını sıfırlar; böylece sonraki
 * `listApplicableStrategies` çağrısı built-in'leri yeniden kurar.
 */
export function __resetSiteStrategiesForTests(): void {
  registeredStrategies.length = 0
  builtinsRegistered = false
}

/**
 * Hostname için eşleşen stratejileri, önceliğe göre azalan sırada döner.
 * Birden fazla strateji eşleşirse hepsi döner; en yüksek öncelikli ilk sıradadır.
 */
export function findStrategiesForHostname(hostname: string): ReadonlyArray<SiteStrategy> {
  const lower = hostname.toLowerCase()
  const matches: SiteStrategy[] = []
  for (const strategy of registeredStrategies) {
    if (strategy.match.hostPatterns.every((pattern) => lower.includes(pattern.toLowerCase()))) {
      matches.push(strategy)
    }
  }
  matches.sort((a, b) => (b.match.priority || 0) - (a.match.priority || 0))
  return matches
}

// ── Built-in strategies ──────────────────────────────────────────────────
// Aşağıdaki stratejiler eski hardcoded mantığın taşıyıcı karşılığıdır. Yeni
// siteler için registerSiteStrategy(...) ile ekleme yapılabilir.

export const SELECTOR_INPUT_RULES: ReadonlyArray<{
  selector: string
  /** Minimum genişlik (px) — küçük olanlar "header" olarak değerlendirilir */
  minWidth: number
  /** Minimum yükseklik (px) */
  minHeight: number
}> = [
  { selector: 'textarea', minWidth: 64, minHeight: 14 },
  { selector: 'div[contenteditable="true"]', minWidth: 64, minHeight: 14 },
  { selector: '.ProseMirror', minWidth: 64, minHeight: 14 },
  { selector: '[data-placeholder]', minWidth: 64, minHeight: 14 },
  { selector: '[role="textbox"]', minWidth: 48, minHeight: 12 },
  { selector: '#chat-input', minWidth: 48, minHeight: 12 },
  { selector: '.chat-input textarea', minWidth: 48, minHeight: 12 },
  { selector: '.input-area', minWidth: 48, minHeight: 12 },
  { selector: '.input-area textarea', minWidth: 48, minHeight: 12 },
  { selector: '.chat-input', minWidth: 48, minHeight: 12 }
]

export const SELECTOR_BUTTON_RULES: ReadonlyArray<string> = [
  // 2026-10-17 canlı chatgpt.com ölçümü (TR dil, hem composer boşken hem
  // metin yazılıyken): sayfadaki TEK `button[type="submit"]` gönder düğmesi
  // ("Gönder"). Dile bağlı değil, kültürel stille değişmiyor ve composer'daki
  // dikte düğmesinden ayrışıyor. Bu yüzden birinci sırada.
  //
  // `[data-composer-submit]` bu ölçümde YOK: composer boşken de metin varken de
  // `querySelectorAll('[data-composer-submit]').length === 0`. Kural ölü bir
  // varsayımdan geliyordu; başta tutmak yalnızca yanlış güven veriyordu.
  // Başka sürümlerde geri gelirse harmanlanabilir kaldırıldı, önceliği yok.
  'button[type="submit"]',
  '[data-composer-submit]',
  'button[data-action="send"]',
  '[role="button"][aria-label*="Send" i]',
  'button.send-btn',
  'button[aria-label*="Send" i]',
  'button[aria-label*="Gönder" i]',
  // Kapsamsız kural yalnızca buton kapsamlı ikizlerinin ALTINDA durmalı: aria-label
  // her elemanda geçerli olduğu için, aksi halde sayfadaki herhangi bir
  // "Send ..." etiketli <span>/<div> gerçek gönder butonunu gölgeler.
  '[aria-label*="Send" i]',
  '[role="button"][aria-label*="Gönder" i]',
  'button[data-testid*="send" i]',
  '.send-btn'
]

/**
 * Composer girdisi olabilecek öğeler. Gönder butonu aranırken önce bunlardan
 * birinin bulunduğu kabuk (composer) belirlenir; buton araması bu kabuğun
 * içinde yapılır. ChatGPT'de composer artık `<textarea>` — ProseMirror ve
 * contenteditable yok.
 */
const COMPOSER_INPUT_SELECTORS: ReadonlyArray<string> = [
  'textarea',
  'div[contenteditable="true"]',
  '.ProseMirror',
  '[role="textbox"]'
]

/**
 * Composer kabuğu adayları, EN DIŞA EN YAKIN olandan başlayarak.
 *
 * 2026-10-17 canlı chatgpt.com ölçümü: eski tek satırlık
 * `form, [role="form"], [class*="composer" i]` kuralı GÖNDER butonu aramasını
 * tamamen işe yaramaz hale getiriyordu. ChatGPT'in composer'ında `<form>` yok
 * ve en yakın sarmalayıcının class'ı şu:
 *   `text-size-chat … in-[[data-composer-body]:has([data-composer-expand-toggle])]:pe-10 …`
 * Yani `"composer"` alt dizesi orada geçiyor, `closest()` orada duruyor ve
 * composer kabuğu **540×36 boyutunda, içinde 0 buton** bir sarmalayıcıya
 * çözülüyordu. Buton araması bu yüzden her zaman boşa düşüp sayfa geneline
 * (~110 düğme) kaçıyordu.
 *
 * Gerçek ve dile bağlı olmayan kabuklar `data-composer-*` ile işaretlenmiş:
 *   `[data-composer-body]` → 768×52, girişi VE dört düğmeyi birden içeriyor.
 * Sınıf/aday listesi en sonda: artık yalnızca gerçek bir kabuk bulunamazsa
 * devreye giriyor.
 */
const COMPOSER_CONTAINER_SELECTORS: ReadonlyArray<string> = [
  '[data-composer-body]',
  '[data-composer-input]',
  '[data-composer-layout]',
  '[data-composer-footer]',
  '[data-testid*="composer" i]',
  '[data-testid*="prompt" i]',
  '[class*="composer" i]',
  'form',
  '[role="form"]'
]

/**
 * Bir kabuğun gönder düğmesi aramaya değer olduğunu doğrular: içinde tıklanabilir
 * bir kontrol bulunmalı. Sınıf alt dizesi eşleşmesi butonsuz bir sarmalayıcıda
 * durabildiği için (ölçülen ChatGPT durumu) bu kontrol, yanlış kabuğu reddetmenin
 * genel yoludur.
 */
function containsClickableControl(root: Element): boolean {
  try {
    return (
      root.querySelector('button, [role="button"], input[type="submit"], input[type="button"]') !==
      null
    )
  } catch {
    return false
  }
}

/**
 * Composer girdisinin bulunduğu kabuğu döner.
 *
 * `requireControls` yalnızca gönder DÜĞMESİ aranırken doğrudur: o durumda
 * butonsuz bir kabuk geçerli bir arama alanı değildir ve arama sessizce
 * sayfa geneline düşerdi. Girdi aranırken bu şart aranmaz (bir sayfanın
 * composer'ı tek başına input içerebilir).
 */
function findComposerContainer(requireControls: boolean): Element | null {
  let input: Element | null = null
  for (const selector of COMPOSER_INPUT_SELECTORS) {
    try {
      input = document.querySelector(selector)
    } catch {
      continue
    }
    if (input) break
  }

  if (input) {
    for (const selector of COMPOSER_CONTAINER_SELECTORS) {
      let container: Element | null = null
      try {
        container = input.closest(selector)
      } catch {
        container = null
      }
      if (!container) continue
      if (requireControls && !containsClickableControl(container)) continue
      return container
    }
  }

  for (const selector of COMPOSER_CONTAINER_SELECTORS) {
    let container: Element | null = null
    try {
      container = document.querySelector(selector)
    } catch {
      container = null
    }
    if (!container) continue
    if (requireControls && !containsClickableControl(container)) continue
    return container
  }

  return null
}

/**
 * Sözlük (dictation) düğmeleri. ChatGPT'de composer boşken görünür tek yuvarlak
 * ikon düğmesi budur; üzerlerine yazı yapıştırılıp bu düğmeye basılırsa mesaj
 * hiç gönderilmez. Bu öznitelikler dile bağlı olmadığı için aria-label'dan daha
 * güvenilir bir red sebebidir.
 */
const DICTATION_ATTRIBUTES: ReadonlyArray<string> = [
  'data-start-dictation',
  'data-cancel-dictation',
  'data-submit-dictation'
]

/**
 * Ses/dikte düğmelerinin DİLE BAĞLI etiketleri.
 *
 * Ölçüm (canlı chatgpt.com, TR): composer içindeki dikte düğmesinin
 * `data-start-dictation` **ya da benzeri bir data özniteliği YOK**.
 * Tam öznitelik listesi: `type="button"`, `class`, `aria-busy="false"`,
 * `aria-label="Dikte et"`. Yani öznitelik listesi bu düğmeye karşı sessizce
 * geçiyordu ve düğme gönder düğmesi sanılıyordu — tıklamak mesajı değil
 * dikteyi başlatıyordu.
 *
 * Aynı yerde bir de `aria-label="Sesli iletişimi başlat"` (EN: "Start voice
 * conversation") var; o da 36×36 ve gönder düğmesiyle aynı yerde duruyor.
 *
 * Etiket dile bağlı olduğu için bu bir "kanıt" değil "güvenli red" kuralıdır:
 * yanlış red yalnızca bir tur daha bekletir, yanlış kabul ise mesajı yanlış
 * yere gönderir. "Gönder"/"Send" bu kalıplarla çakışmaz.
 */
export const VOICE_CONTROL_LABEL_PATTERN =
  /(^|\s|-|_)(mikrofon|sesli|dikte|konuş|konus|mic|dictate|dictation|voice|speak|talk|record|recording|transcribe|transcription)(\s|-|_|$)/i

function isVoiceControl(candidate: Element): boolean {
  if (!candidate || typeof candidate.hasAttribute !== 'function') return false
  for (const attribute of DICTATION_ATTRIBUTES) {
    if (candidate.hasAttribute(attribute)) return true
  }
  try {
    const label =
      (candidate.getAttribute('aria-label') || '') + ' ' + (candidate.getAttribute('title') || '')
    if (label.trim() && VOICE_CONTROL_LABEL_PATTERN.test(label)) return true
  } catch {
    // getAttribute yoksa yalnızca öznitelik listesi geçerli olur
  }
  return false
}

function isVisibleCandidate(candidate: Element, minWidth: number, minHeight: number): boolean {
  if (!candidate || !candidate.isConnected) return false
  const rect = candidate.getBoundingClientRect()
  if (rect.width < minWidth || rect.height < minHeight) return false
  // `hidden` özniteliği tarayıcının (ve JSDOM'un) varsayılan stil
  // sayfasında display:none'a dönüşür, yani composer boşken gizlenen gönder
  // düğmesi computed-style kontrolünde zaten elenir.
  const style = window.getComputedStyle(candidate)
  if (style.visibility === 'hidden' || style.display === 'none') return false
  return true
}

/**
 * Verilen kapsayıcıda selector'a uyan İLK görünür öğeyi döner. Tüm eşleşmeler
 * taranır: ilk eşleşme görünmezse (off-screen, 0 boyutlu) bir sonrakine geçilir.
 */
function findVisibleBySelector(
  root: ParentNode,
  selector: string,
  minWidth: number,
  minHeight: number
): Element | null {
  let matches: ArrayLike<Element>
  try {
    matches = root.querySelectorAll(selector)
  } catch {
    return null
  }
  for (let i = 0; i < matches.length; i++) {
    if (isVisibleCandidate(matches[i], minWidth, minHeight)) return matches[i]
  }
  return null
}

function tryGenericInputFallback(): SiteStrategyCandidate | null {
  for (const rule of SELECTOR_INPUT_RULES) {
    const el = findVisibleBySelector(document, rule.selector, rule.minWidth, rule.minHeight)
    if (el) {
      return {
        element: el,
        matchedSelector: 'generic:input:' + rule.selector,
        strategy: 'provider'
      }
    }
  }
  return null
}

/** İlk kuralın verdiği kapsam + eşleşen öğe. */
function findButtonInRoot(root: ParentNode): { element: Element; selector: string } | null {
  for (const selector of SELECTOR_BUTTON_RULES) {
    let matches: ArrayLike<Element>
    try {
      matches = root.querySelectorAll(selector)
    } catch {
      continue
    }
    for (let i = 0; i < matches.length; i++) {
      const el = matches[i]
      if (isVoiceControl(el)) continue
      if (isVisibleCandidate(el, 8, 8)) return { element: el, selector }
    }
  }
  return null
}

/**
 * Composer içindeki gerçek gönder düğmesi.
 *
 * Ölçüm (canlı chatgpt.com): composer'da dört düğme var ve gönder düğmesi
 * `type="submit"` olan tek öğe. Aynı anda bir dikte düğmesi (`type="button"`,
 * `aria-label="Dikte et"`) de duruyor. Kurallar listesinde `button[type=submit]`
 * birinci olduğu için bu zaten ilk eşleşme olur; bu adım tek farkla onu
 * "karar" haline getirir — composer kapsamı bulunduğunda sayfa geneline hiç
 * bakılmaz.
 */
function findComposerSubmit(
  composer: Element | null
): { element: Element; selector: string } | null {
  if (!composer) return null
  let matches: ArrayLike<Element>
  try {
    matches = composer.querySelectorAll('button[type="submit"], input[type="submit"]')
  } catch {
    return null
  }
  for (let i = 0; i < matches.length; i++) {
    const el = matches[i]
    if (isVoiceControl(el)) continue
    if (isVisibleCandidate(el, 8, 8)) return { element: el, selector: 'composer:submit' }
  }
  return null
}

function tryGenericButtonFallback(): SiteStrategyCandidate | null {
  // Önce composer kabuğunun kendisi: ölçülen ChatGPT durumunda buton araması
  // 110 düğmelik sayfa genelinde değil, dört düğmelik gerçek composer'da
  // yapılır. Kabuk, tıklanabilir bir kontrol içermiyorsa geçerli bir arama
  // alanı değildir ve reddedilir.
  const composer = findComposerContainer(true)
  if (composer) {
    const decisive = findComposerSubmit(composer)
    if (decisive) {
      return {
        element: decisive.element,
        matchedSelector: 'generic:button:' + decisive.selector,
        strategy: 'provider'
      }
    }
  }

  // Sayfa genelindeki arama yalnızca composer'da gönder düğmesi yoksa devreye
  // girer: sayfada 7 adet `button[type="submit"]` olabiliyor (diyalogların
  // "Kapat" düğmeleri + gerçek gönder düğmesi) ve DOM sırasına göre seçmek
  // yanlış düğmeye basmak demek.
  const roots: ReadonlyArray<ParentNode> = composer ? [composer, document] : [document]
  for (const root of roots) {
    const found = findButtonInRoot(root)
    if (found) {
      return {
        element: found.element,
        matchedSelector: 'generic:button:' + found.selector,
        strategy: 'provider'
      }
    }
  }
  return null
}

function registerBuiltinStrategy(strategy: Omit<SiteStrategy, 'id'>, id: string): void {
  registerSiteStrategy({ id, ...strategy })
}

function tryGenericByKind(kind: SiteStrategyKind): SiteStrategyCandidate | null {
  return kind === 'input' ? tryGenericInputFallback() : tryGenericButtonFallback()
}

let builtinsRegistered = false
function ensureBuiltinsRegistered(): void {
  if (builtinsRegistered) return
  builtinsRegistered = true

  for (const [id, hostPatterns] of [
    ['builtin:claude', ['claude.ai']],
    ['builtin:deepseek', ['deepseek.com']],
    ['builtin:qwen', ['qwen']],
    ['builtin:kimi', ['kimi']],
    ['builtin:chatgpt', ['chatgpt.com']],
    ['builtin:gemini', ['gemini.google.com']],
    ['builtin:aistudio', ['aistudio.google.com']],
    ['builtin:m365', ['copilot.microsoft.com']],
    ['builtin:youtube', ['youtube.com']],
    ['builtin:api-chat', ['api-chat']]
  ] as const) {
    registerBuiltinStrategy(
      {
        match: { hostPatterns: [...hostPatterns] },
        produce: tryGenericByKind
      },
      id
    )
  }

  // Generic fallback - her host için geçerli, en düşük öncelikli.
  // Burada (ensureBuiltinsRegistered içinde) kayıt edilmesinin sebebi:
  // `__resetSiteStrategiesForTests` ile state temizlendiğinde sonraki
  // `listApplicableStrategies` çağrısında generic stratejinin yeniden
  // kurulmasını garanti etmek.
  registerBuiltinStrategy(
    {
      match: { hostPatterns: [''], priority: -100 },
      produce: (kind) => {
        if (kind === 'input') {
          return tryGenericInputFallback()
        }
        return tryGenericButtonFallback()
      }
    },
    'builtin:generic'
  )
}

/**
 * Stratejilerin tamamını (built-in + kayıtlı) hostname'e göre sıralar.
 * İlk döngü çağrısında built-in'leri kayıt eder.
 */
export function listApplicableStrategies(hostname: string): ReadonlyArray<SiteStrategy> {
  ensureBuiltinsRegistered()
  return findStrategiesForHostname(hostname)
}

// Eager builtin kayıt (renderer tarafında import edildiğinde)
ensureBuiltinsRegistered()
