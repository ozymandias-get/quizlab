/**
 * 📐 AI Webview — Heavy entry point (lazy-loadable)
 *
 * This barrel contains the AI webview component that pulls in the full
 * AI session management, tab strip, and related hooks.
 * Consumers should lazy-load this module to keep it out of the main chunk.
 */
export { default as AiWebview } from './ui/AiWebview'
