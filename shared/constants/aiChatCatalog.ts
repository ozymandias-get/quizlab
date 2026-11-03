import type { AiPlatform } from '../types/ai.js'
import { GOOGLE_AI_WEB_SESSION_PARTITION } from './googleAiWebApps.js'

/** Web chat entry points, not a traffic ranking or an API model inventory.
 * Existing specialised providers keep their selectors and session partitions.
 * Additional providers are opt-in; opening one never pins it to the dock.
 */
const CHAT_SERVICES = [
  ['copilot', 'Copilot', 'https://copilot.microsoft.com'],
  ['grok', 'Grok', 'https://grok.com'],
  ['huggingchat', 'HuggingChat', 'https://huggingface.co/chat/'],
  ['manus', 'Manus', 'https://manus.im'],
  ['mistral', 'Le Chat', 'https://chat.mistral.ai'],
  ['perplexity', 'Perplexity', 'https://www.perplexity.ai'],
  ['poe', 'Poe', 'https://poe.com'],
  ['you', 'You.com', 'https://you.com/search'],
  ['duckai', 'Duck.ai', 'https://duck.ai'],
  ['venice', 'Venice', 'https://venice.ai/chat'],
  ['lumo', 'Lumo', 'https://lumo.proton.me'],
  ['meta', 'Meta AI', 'https://www.meta.ai'],
  ['pi', 'Pi', 'https://pi.ai'],
  ['character', 'Character.AI', 'https://character.ai'],
  ['replika', 'Replika', 'https://my.replika.com'],
  ['deepai', 'DeepAI', 'https://deepai.org/chat'],
  ['andi', 'Andi', 'https://andisearch.com'],
  ['blackbox', 'BLACKBOX AI', 'https://www.blackbox.ai/'],
  ['githubcopilot', 'GitHub Copilot', 'https://github.com/copilot'],
  ['notebooklm', 'NotebookLM', 'https://notebook.google.com'],
  ['zai', 'Z.ai', 'https://chat.z.ai'],
  ['minimax', 'MiniMax', 'https://chat.minimax.io'],
  ['doubao', 'Doubao', 'https://www.doubao.com/chat/'],
  ['yuanbao', 'Tencent Yuanbao', 'https://yuanbao.tencent.com'],
  ['ernie', 'ERNIE / Wenxin', 'https://wenxin.baidu.com'],
  ['spark', 'iFlytek Spark', 'https://xinghuo.xfyun.cn'],
  ['stepfun', 'StepFun', 'https://chat.stepfun.com'],
  ['longcat', 'LongCat', 'https://longcat.chat'],
  ['allenai', 'Allen AI Playground', 'https://playground.allenai.org'],
  ['monica', 'Monica', 'https://monica.im/home'],
  ['merlin', 'Merlin', 'https://www.getmerlin.in/chat'],
  ['chatsonic', 'Chatsonic', 'https://app.writesonic.com'],
  ['jasper', 'Jasper Chat', 'https://app.jasper.ai'],
  ['textcortex', 'TextCortex', 'https://app.textcortex.com'],
  ['hix', 'HIX AI', 'https://hix.ai'],
  ['coral', 'Cohere Coral', 'https://coral.cohere.com'],
  ['maxai', 'MaxAI', 'https://www.maxai.co/app/'],
  ['abacus', 'Abacus ChatLLM', 'https://apps.abacus.ai/chatllm/'],
  ['genspark', 'Genspark', 'https://www.genspark.ai'],
  ['felo', 'Felo', 'https://felo.ai/search'],
  ['scira', 'Scira', 'https://scira.ai'],
  ['t3chat', 'T3 Chat', 'https://t3.chat']
] as const

/** Brand accents keep every service icon visually distinct and colourful. */
const AI_SERVICE_COLORS: Record<string, string> = {
  chatgpt: '#10a37f',
  gemini: '#4285f4',
  claude: '#d97706',
  deepseek: '#4f46e5',
  qwen: '#6366f1',
  kimi: '#f97316',
  aistudio: '#4285f4',
  youtube: '#ff0033',
  m365: '#00a4ef',
  'api-chat': '#f59e0b',
  gdrive: '#1a73e8',
  globe: '#64748b',
  copilot: '#0ea5e9',
  grok: '#6366f1',
  huggingchat: '#ffd21e',
  manus: '#d97706',
  mistral: '#ff7000',
  perplexity: '#1fb8cd',
  poe: '#5d5cde',
  you: '#4f46e5',
  duckai: '#de5833',
  venice: '#0ea5e9',
  lumo: '#6d4aff',
  meta: '#0866ff',
  pi: '#6b8afd',
  character: '#3b82f6',
  replika: '#6f4ef2',
  deepai: '#6366f1',
  andi: '#6366f1',
  blackbox: '#6366f1',
  githubcopilot: '#6e40c9',
  notebooklm: '#4285f4',
  zai: '#5b6cff',
  minimax: '#7c3aed',
  doubao: '#3b82f6',
  yuanbao: '#2f6bff',
  ernie: '#2932e1',
  spark: '#e60012',
  stepfun: '#10b981',
  longcat: '#f97316',
  allenai: '#2563eb',
  monica: '#7c3aed',
  merlin: '#6366f1',
  chatsonic: '#f97316',
  jasper: '#a855f7',
  textcortex: '#6366f1',
  hix: '#3b82f6',
  coral: '#22c55e',
  maxai: '#6366f1',
  abacus: '#0ea5e9',
  genspark: '#6366f1',
  felo: '#10b981',
  scira: '#6366f1',
  t3chat: '#8b5cf6'
}

export function getAiServiceColor(id: string): string | undefined {
  return AI_SERVICE_COLORS[id]
}

export const ADDITIONAL_AI_CHAT_PLATFORMS: Record<string, AiPlatform> = Object.fromEntries(
  CHAT_SERVICES.map(([id, name, url]) => [
    id,
    {
      id,
      name,
      displayName: name,
      icon: id,
      url,
      color: AI_SERVICE_COLORS[id] ?? '#64748b',
      partition: id === 'notebooklm' ? GOOGLE_AI_WEB_SESSION_PARTITION : `persist:ai_${id}`,
      defaultEnabled: false,
      defaultDockVisible: false,
      // No provider-specific automation is claimed for catalogue entries.
      selectors: { input: null, button: null, waitFor: null },
      submitMode: 'mixed'
    }
  ])
)

/** The same default must be used by dock rendering and its settings toggles. */
export function isAiDockVisible(
  id: string,
  visibility: Record<string, boolean>,
  platform?: Pick<AiPlatform, 'defaultDockVisible'>,
  favoriteModels: readonly string[] = []
): boolean {
  return (
    visibility[id] ?? (favoriteModels.includes(id) ? true : (platform?.defaultDockVisible ?? true))
  )
}
