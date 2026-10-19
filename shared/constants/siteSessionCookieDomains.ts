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
  m365: ['.microsoft.com', '.microsoftonline.com', '.live.com'],
  copilot: ['.microsoft.com', '.microsoftonline.com', '.live.com'],
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
