import crypto from 'crypto'

export function generateCspNonce(): string {
  return crypto.randomBytes(16).toString('base64')
}

export function getStrictCsp(nonce: string): string {
  return [
    "default-src 'self' blob: local-pdf:",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' blob:`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-src https://chatgpt.com https://*.chatgpt.com https://claude.ai https://*.claude.ai https://gemini.google.com https://aistudio.google.com https://www.youtube.com https://drive.google.com https://chat.deepseek.com https://chat.qwenlm.ai https://chat.qwen.ai https://kimi.com https://kimi.moonshot.cn https://copilot.microsoft.com https://grok.com https://huggingface.co https://manus.im https://chat.mistral.ai https://perplexity.ai https://accounts.google.com https://myaccount.google.com https://auth.openai.com https://auth0.openai.com https://platform.openai.com https://login.microsoftonline.com https://login.live.com https://login.x.com https://challenges.cloudflare.com https://cdn.cloudflare.com blob:",
    "child-src blob:",
    "worker-src 'self' blob:",
    "img-src 'self' data: blob:",
    "connect-src 'self' blob: local-pdf:"
  ].join('; ')
}

export function getDevCsp(): string {
  return [
    "default-src 'self' blob: local-pdf:",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-src https://chatgpt.com https://*.chatgpt.com https://claude.ai https://*.claude.ai https://gemini.google.com https://aistudio.google.com https://www.youtube.com https://drive.google.com https://chat.deepseek.com https://chat.qwenlm.ai https://chat.qwen.ai https://kimi.com https://kimi.moonshot.cn https://copilot.microsoft.com https://grok.com https://huggingface.co https://manus.im https://chat.mistral.ai https://perplexity.ai https://accounts.google.com https://myaccount.google.com https://auth.openai.com https://auth0.openai.com https://platform.openai.com https://login.microsoftonline.com https://login.live.com https://login.x.com https://challenges.cloudflare.com https://cdn.cloudflare.com blob:",
    "child-src blob:",
    "worker-src 'self' blob:",
    "img-src 'self' data: blob:",
    "connect-src 'self' blob: local-pdf:"
  ].join('; ')
}
