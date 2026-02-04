export type SubmitMode = 'click' | 'enter_key' | 'mixed';
export interface AiSelectorConfig {
    input?: string | null;
    button?: string | null;
    waitFor?: string | null;
    submitMode?: SubmitMode | string;
    [key: string]: unknown;
}
export interface AiPlatformMeta {
    displayName?: string;
    submitMode?: SubmitMode | string;
    domainRegex?: string;
    imageWaitTime?: number;
}
export interface AiPlatform {
    id: string;
    name: string;
    url: string;
    partition?: string;
    icon?: string;
    color?: string;
    selectors?: {
        input?: string | null;
        button?: string | null;
        waitFor?: string | null;
    };
    meta?: AiPlatformMeta;
    isCustom?: boolean;
    [key: string]: unknown;
}
export interface EnhancedAiPlatform extends AiPlatform {
    displayName?: string;
    submitMode?: SubmitMode | string;
    domainRegex?: string;
    imageWaitTime?: number;
    input?: string | null;
    button?: string | null;
    waitFor?: string | null;
}
export type AiRegistry = Record<string, EnhancedAiPlatform>;
export type InactivePlatforms = Record<string, AiPlatform>;
/**
 * AI Modül Yöneticisi (Registry)
 * Tüm AI platformlarını tek bir noktadan yönetir ve dışa aktarır.
 */
declare const CHROME_USER_AGENT: string;
declare const isAuthDomain: (hostname?: string) => boolean;
declare const inactivePlatforms: InactivePlatforms;
declare const AI_REGISTRY: AiRegistry;
declare const DEFAULT_AI_ID = "chatgpt";
declare const GET_AI_CONFIG: (id: string) => EnhancedAiPlatform;
declare const GET_ALL_AI_IDS: () => string[];
export { CHROME_USER_AGENT, isAuthDomain, AI_REGISTRY, DEFAULT_AI_ID, GET_AI_CONFIG, GET_ALL_AI_IDS, inactivePlatforms as INACTIVE_PLATFORMS };
