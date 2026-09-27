/**
 * Model families known to accept image input on OpenAI-compatible
 * `/chat/completions` endpoints.
 *
 * This gates whether the attachment button is offered in the api-chat
 * composer, so it must be broad: a model that is missing here silently hides
 * image support from the user. Known current-generation families come first,
 * followed by generic open-weight vision naming conventions (llava, *-vl,
 * *-vision, …) so locally hosted VLMs behind Ollama/LM Studio/vLLM are covered
 * without enumerating every checkpoint.
 */
export const VISION_MODEL_PATTERNS = [
  // --- OpenAI ---
  // gpt-4o, gpt-4o-mini, gpt-4o-2024-08-06, chatgpt-4o-latest
  /^gpt-4o/i,
  // gpt-4-turbo, gpt-4.0-turbo, gpt-4-1106-turbo, gpt-4.1-turbo, gpt-4.2-turbo
  /^gpt-4(?:[.-]\d+)*-turbo/i,
  // gpt-4, gpt-4.1, gpt-4.1-mini, gpt-4.5-preview — every gpt-4 generation is
  // multimodal. The lookahead keeps `gpt-40`-style ids from matching.
  /^gpt-4(?![0-9])/i,
  // gpt-5, gpt-5-mini, gpt-5.1
  /^gpt-5(?![0-9])/i,
  // o1, o1-mini, o1-preview, o3, o3-mini, o4-mini
  /^o[134](?:[-.]|$)/i,

  // --- Anthropic ---
  // claude-3, claude-3.5, claude-3.7, claude-4, claude-sonnet-4-5,
  // claude-opus-4-1, claude-haiku-4-5. `claude-2.x` stays excluded.
  /^claude-(?:[34]|sonnet|opus|haiku)/i,

  // --- Google ---
  // gemini-1.5-pro/flash, gemini-2.0/2.5/3.x
  /^gemini-(?:1\.5|[23])/i,

  // --- Open-weight / local vision models ---
  // llava, llava-llama3, bakllava, moondream, moondream2, pixtral
  /^(?:llava|bakllava|moondream|moondream2|pixtral)/i,
  // llama3.2-vision, llama-3.2-11b-vision-instruct
  /^llama-?3[.\d]*-vision/i,
  // qwen-vl, qwen2-vl, qwen2.5-vl-7b
  /^qwen-?[\d.]*-?vl/i,
  // minicpm-v, minicpm-v-2_6
  /^minicpm-v/i,
  // gemma3, gemma-3-27b-it (multimodal)
  /^gemma-?3/i,
  // internvl2, internvl3, internvl3-8b
  /^internvl/i,
  // phi-3.5-vision-instruct, phi-4-multimodal, phi3-vision
  /^phi-?[\d.]*-(?:vision|multimodal)/i,
  // deepseek-vl, glm-4v, glm-4.5v, cogvlm
  /^(?:deepseek-vl|glm-[\d.]+v|cogvlm)/i,
  // Generic open-weight conventions: `…-vision`, `…-vl`, `…-vlm`, `smolvlm`
  /(?:vision|(?:^|[-_.])vl(?:[-_.]|$)|vlm)/i
] as const

export function isVisionCapable(modelId: string): boolean {
  if (!modelId) return false
  return VISION_MODEL_PATTERNS.some((re) => re.test(modelId))
}
