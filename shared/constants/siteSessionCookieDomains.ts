/**
 * The domains the two Microsoft sites share.
 *
 * `m365` and `copilot` are two platforms on two partitions, but they
 * authenticate against the same Microsoft account: they read the same
 * cookies. The shared part is written once, so an edit to one of them cannot
 * leave the other behind.
 */
const MICROSOFT_COOKIE_DOMAINS = ['.microsoft.com', '.microsoftonline.com', '.live.com'] as const

/**
 * Site başına çerez alan adları.
 *
 * Bu tablo **elle** yazılmış tek kaynaktır: eklentinin `manifest.json`
 * izni, köprünün alan adı kontrolü ve ana sürecin routing'i hep buradan
 * türer. `electron/__tests__/features/web-session/siteSessionCookieDomains.test.ts`
 * manifest'in bu tabloyu kapsadığını sabitler.
 *
 * Alan adları `chrome.cookies.getAll({ domain })` filtresine **olduğu gibi**
 * verilir; baştaki nokta alan- geniş kapsamlı (domain) çerezi, noktasız hâli
 * host-only çerezi belirtir.
 */
export const SITE_SESSION_COOKIE_DOMAINS = {
  chatgpt: ['.chatgpt.com', '.openai.com'],
  claude: ['.claude.ai', '.anthropic.com'],
  google: ['.google.com', '.gemini.google.com', '.aistudio.google.com', '.youtube.com'],
  deepseek: ['.deepseek.com'],
  qwen: ['.qwenlm.ai', '.qwen.ai'],
  kimi: ['.kimi.com', '.moonshot.cn'],
  // `m365.cloud.microsoft` is NOT a subdomain of `microsoft.com`: the site
  // lives under `cloud.microsoft`, and without that domain the extension
  // never reads the site's own cookie and the switch-off never signs the
  // user out.
  m365: [...MICROSOFT_COOKIE_DOMAINS, '.cloud.microsoft'],
  copilot: MICROSOFT_COOKIE_DOMAINS,
  grok: ['.grok.com', '.x.com'],
  mistral: ['.mistral.ai'],
  perplexity: ['.perplexity.ai'],
  huggingchat: ['.huggingface.co'],
  manus: ['.manus.im']
} as const satisfies Record<string, readonly string[]>

export function getSiteSessionCookieDomains(siteId: string): readonly string[] {
  // `Object.hasOwn` keeps prototype-chain ids ('constructor', '__proto__', …) from
  // resolving to `Object.prototype` members: the table is a plain object literal, so
  // a bare lookup would hand back the inherited member instead of an empty list.
  if (!Object.hasOwn(SITE_SESSION_COOKIE_DOMAINS, siteId)) {
    return []
  }
  const domains = (SITE_SESSION_COOKIE_DOMAINS as Record<string, readonly string[] | undefined>)[
    siteId
  ]
  return domains ?? []
}
