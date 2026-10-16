/**
 * Site Strategy Registry
 * ─────────────────────────────────────────────────────────────────────────────
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

const SELECTOR_INPUT_RULES: ReadonlyArray<{
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

const SELECTOR_BUTTON_RULES: ReadonlyArray<string> = [
  // 2026-10-17 ölçümü (canlı chatgpt.com): yeni composer'da gönder butonu
  // data-composer-submit taşıyor. Bu, dile bağlı olmayan ve sayfadaki tek
  // kararlı kancadır; aria-label çevrildiği için ("Mesaj gönder" / "Send
  // message") locale'a bağlı, data-testid ise hiç yok.
  '[data-composer-submit]',
  'button[type="submit"]',
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
 * Composer kabuğu: gerçek bir form, ARIA form rolü ya da class'ında "composer"
 * geçen kapsayıcı. Gönder butonu ile composer'ın aynı kabukta olması, butonun
 * "bu sohbetin gönder düğmesi" olduğunun en ucuz kanıtıdır.
 */
const COMPOSER_CONTAINER_SELECTOR = 'form, [role="form"], [class*="composer" i]'

/**
 * Composer girdisinin bulunduğu en yakın kabuğu döner. Composer girdisi yoksa
 * sayfadaki ortak form kabuğuna düşer (bulunamazsa null).
 */
function findComposerContainer(): Element | null {
  for (const selector of COMPOSER_INPUT_SELECTORS) {
    let input: Element | null = null
    try {
      input = document.querySelector(selector)
    } catch {
      continue
    }
    if (!input) continue
    try {
      const container = input.closest(COMPOSER_CONTAINER_SELECTOR)
      if (container) return container
    } catch {
      // closest bu ortamda yoksa form kabuğu denenir
    }
  }
  try {
    return document.querySelector('form, [role="form"]')
  } catch {
    return null
  }
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

function isDictationControl(candidate: Element): boolean {
  if (!candidate || typeof candidate.hasAttribute !== 'function') return false
  for (const attribute of DICTATION_ATTRIBUTES) {
    if (candidate.hasAttribute(attribute)) return true
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
      if (isDictationControl(el)) continue
      if (isVisibleCandidate(el, 8, 8)) return { element: el, selector }
    }
  }
  return null
}

function tryGenericButtonFallback(): SiteStrategyCandidate | null {
  // Önce composer kabuğunun içi: sayfa genelinde 7 adet button[type="submit"]
  // olabiliyor (diyalogların "Kapat" düğmeleri + gerçek gönder düğmesi) ve
  // DOM sırasına göre seçmek yanlış düğmeye basmak demek. Sayfa genelindeki arama
  // yalnızca composer'da hiçbir şey bulunamazsa devreye girer.
  const composer = findComposerContainer()
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

/**
 * Uzak sayfa runtime'ında strateji çağrısı. Bu fonksiyon string template'e
 * dönüştürülürken yalnızca iskelet kalır.
 *
 * Template, TS tarafındaki genel kurallarla aynı composer/diktasyon yardımcılarını
 * da taşır: bu blok runtime'da ikinci sırada enjekte edilir, bu yüzden hem
 * sonradan gelen site stratejileri hem de fallbackPipeline aynı "dikte düğmesi
 * gönder düğmesi değildir / gönder düğmesi composer'ın içindedir" kuralını
 * kullanabilir. Yardımcılar burada tanımlı olduğu için fallbackPipeline
 * (aşağıda) onları yeniden tanımlamaz.
 */
export const siteStrategyRuntime = `    const __DICTATION_ATTRIBUTES = ['data-start-dictation', 'data-cancel-dictation', 'data-submit-dictation'];
    const __COMPOSER_INPUT_SELECTOR = 'textarea, div[contenteditable="true"], .ProseMirror, [role="textbox"]';
    const __COMPOSER_CONTAINER_SELECTOR = 'form, [role="form"], [class*="composer" i]';

    /**
     * Sözlük (dictation) düğmesi mi? ChatGPT'de composer boşken görünür tek
     * yuvarlak ikon düğmesi budur; mesaj yapıştırıldıktan sonra yanlışlıkla ona
     * basmak göndermeyi sessizce engeller. Etiket dile bağlı olduğu için
     * (TR: "Dikteyi başlatma", EN: "Start dictation") bu data öznitelikleri
     * tek güvenilir red sebebi.
     */
    const __isDictationControl = (el) => {
        if (!el || typeof el.hasAttribute !== 'function') return false;
        for (let i = 0; i < __DICTATION_ATTRIBUTES.length; i++) {
            if (el.hasAttribute(__DICTATION_ATTRIBUTES[i])) return true;
        }
        return false;
    };

    /**
     * Composer girdisinin bulunduğu en yakın kabuk (form / [role=form] /
     * class'ında "composer" geçen kapsayıcı). Girdi yoksa sayfadaki ortak form
     * kabuğuna düşer. ChatGPT'de composer artık <textarea>; ProseMirror ve
     * contenteditable yok.
     */
    const __findComposerContainer = () => {
        let input = null;
        try {
            input = document.querySelector(__COMPOSER_INPUT_SELECTOR);
        } catch (e) {
            input = null;
        }
        if (input && input.closest) {
            try {
                const container = input.closest(__COMPOSER_CONTAINER_SELECTOR);
                if (container) return container;
            } catch (e) {
                // closest desteklenmiyorsa ortak form kabuğu denenir
            }
        }
        try {
            return document.querySelector('form, [role="form"]');
        } catch (e) {
            return null;
        }
    };

    /** Composer kabuğunun kendisi mi, içindeki bir öğe mi? */
    const __isComposerSubmitControl = (el, container) => {
        if (!el || typeof el.hasAttribute !== 'function') return false;
        if (!el.hasAttribute('data-composer-submit')) return false;
        if (!container) return false;
        if (container === el) return true;
        try {
            return Boolean(container.contains && container.contains(el));
        } catch (e) {
            return false;
        }
    };

    const __SITE_STRATEGIES = [];
    const __registerSiteStrategy = (strategy) => {
        if (!strategy || typeof strategy.id !== 'string') return;
        const existingIdx = __SITE_STRATEGIES.findIndex((s) => s.id === strategy.id);
        if (existingIdx >= 0) {
            __SITE_STRATEGIES[existingIdx] = strategy;
        } else {
            __SITE_STRATEGIES.push(strategy);
        }
    };
    const __listApplicableStrategies = (hostname) => {
        const lower = String(hostname || '').toLowerCase();
        const matches = [];
        for (let i = 0; i < __SITE_STRATEGIES.length; i++) {
            const strategy = __SITE_STRATEGIES[i];
            const patterns = (strategy.match && strategy.match.hostPatterns) || [];
            let allMatch = true;
            for (let j = 0; j < patterns.length; j++) {
                if (lower.indexOf(String(patterns[j]).toLowerCase()) < 0) {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch) matches.push(strategy);
        }
        matches.sort(function (a, b) {
            return ((b.match && b.match.priority) || 0) - ((a.match && a.match.priority) || 0);
        });
        return matches;
    };
    const __runSiteStrategy = (hostname, kind) => {
        const matches = __listApplicableStrategies(hostname);
        for (let i = 0; i < matches.length; i++) {
            try {
                const result = matches[i].produce(kind);
                if (result && result.element) {
                    return Object.assign({ strategyId: matches[i].id }, result);
                }
            } catch (e) {
                // strateji patlarsa sessizce sonrakine geç
            }
        }
        return null;
    };
`

// Eager builtin kayıt (renderer tarafında import edildiğinde)
ensureBuiltinsRegistered()
