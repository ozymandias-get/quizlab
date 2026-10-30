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
  ['blackbox', 'BLACKBOX AI', 'https://app.blackbox.ai'],
  ['githubcopilot', 'GitHub Copilot', 'https://github.com/copilot'],
  ['notebooklm', 'NotebookLM', 'https://notebooklm.google.com'],
  ['zai', 'Z.ai', 'https://chat.z.ai'],
  ['minimax', 'MiniMax', 'https://chat.minimax.io'],
  ['doubao', 'Doubao', 'https://www.doubao.com/chat/'],
  ['yuanbao', 'Tencent Yuanbao', 'https://yuanbao.tencent.com'],
  ['ernie', 'ERNIE / Wenxin', 'https://wenxin.baidu.com'],
  ['spark', 'iFlytek Spark', 'https://xinghuo.xfyun.cn'],
  ['stepfun', 'StepFun', 'https://chat.stepfun.com'],
  ['longcat', 'LongCat', 'https://longcat.ai'],
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

export const ADDITIONAL_AI_CHAT_PLATFORMS: Record<string, AiPlatform> = Object.fromEntries(
  CHAT_SERVICES.map(([id, name, url]) => [
    id,
    {
      id,
      name,
      displayName: name,
      icon: id,
      url,
      color: id === 'notebooklm' ? '#4b5563' : '#64748b',
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
