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
  'button[type="submit"]',
  'button[data-action="send"]',
  '[role="button"][aria-label*="Send" i]',
  'button.send-btn',
  '[aria-label*="Send" i]',
  'button[aria-label*="Send" i]',
  'button[aria-label*="Gönder" i]',
  '[role="button"][aria-label*="Gönder" i]',
  'button[data-testid*="send" i]',
  '.send-btn'
]

function findVisibleBySelector(
  selector: string,
  minWidth: number,
  minHeight: number
): Element | null {
  let candidate: Element | null = null
  try {
    candidate = document.querySelector(selector)
  } catch {
    return null
  }
  if (!candidate || !candidate.isConnected) return null
  const rect = candidate.getBoundingClientRect()
  if (rect.width < minWidth || rect.height < minHeight) return null
  const style = window.getComputedStyle(candidate)
  if (style.visibility === 'hidden' || style.display === 'none') return null
  return candidate
}

function tryGenericInputFallback(): SiteStrategyCandidate | null {
  for (const rule of SELECTOR_INPUT_RULES) {
    const el = findVisibleBySelector(rule.selector, rule.minWidth, rule.minHeight)
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

function tryGenericButtonFallback(): SiteStrategyCandidate | null {
  for (const selector of SELECTOR_BUTTON_RULES) {
    const el = findVisibleBySelector(selector, 8, 8)
    if (el) {
      return {
        element: el,
        matchedSelector: 'generic:button:' + selector,
        strategy: 'provider'
      }
    }
  }
  return null
}

function registerBuiltinStrategy(strategy: Omit<SiteStrategy, 'id'>, id: string): void {
  registerSiteStrategy({ id, ...strategy })
}

let builtinsRegistered = false
function ensureBuiltinsRegistered(): void {
  if (builtinsRegistered) return
  builtinsRegistered = true

  registerBuiltinStrategy(
    {
      match: { hostPatterns: ['claude.ai'] },
      produce: (kind) => {
        if (kind === 'input') {
          return tryGenericInputFallback()
        }
        return tryGenericButtonFallback()
      }
    },
    'builtin:claude'
  )

  registerBuiltinStrategy(
    {
      match: { hostPatterns: ['deepseek.com'] },
      produce: (kind) => {
        if (kind === 'input') {
          return tryGenericInputFallback()
        }
        return tryGenericButtonFallback()
      }
    },
    'builtin:deepseek'
  )

  registerBuiltinStrategy(
    {
      match: { hostPatterns: ['qwen'] },
      produce: (kind) => {
        if (kind === 'input') {
          return tryGenericInputFallback()
        }
        return tryGenericButtonFallback()
      }
    },
    'builtin:qwen'
  )

  registerBuiltinStrategy(
    {
      match: { hostPatterns: ['kimi'] },
      produce: (kind) => {
        if (kind === 'input') {
          return tryGenericInputFallback()
        }
        return tryGenericButtonFallback()
      }
    },
    'builtin:kimi'
  )

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
 * Webview runtime'ında strateji çağrısı. Bu fonksiyon string template'e
 * dönüştürülürken yalnızca iskelet kalır.
 */
export const siteStrategyRuntime = `    const __SITE_STRATEGIES = [];
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
