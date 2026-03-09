export const GOOGLE_AI_WEB_SESSION_PARTITION = 'persist:gemini_web_profile'

export type GoogleWebSessionAppId = 'gemini' | 'notebooklm' | 'aistudio' | 'youtube' | 'gdrive'
type GoogleWebSessionSurface = 'ai' | 'site' | 'pdf'

interface GoogleWebSessionAppDefinition {
    id: GoogleWebSessionAppId;
    name: string;
    url: string;
    hostname: string;
    icon: string;
    color: string;
    surface: GoogleWebSessionSurface;
    registryEligible: boolean;
    healthCheckEligible: boolean;
    healthPathPrefixes: string[];
}

export const GOOGLE_WEB_SESSION_APPS: GoogleWebSessionAppDefinition[] = [
    {
        id: 'gemini',
        name: 'Gemini',
        url: 'https://gemini.google.com/app',
        hostname: 'gemini.google.com',
        icon: 'gemini',
        color: '#f9ab00',
        surface: 'ai',
        registryEligible: true,
        healthCheckEligible: true,
        healthPathPrefixes: ['/app']
    },
    {
        id: 'notebooklm',
        name: 'NotebookLM',
        url: 'https://notebooklm.google.com/',
        hostname: 'notebooklm.google.com',
        icon: 'notebooklm',
        color: '#34a853',
        surface: 'ai',
        registryEligible: true,
        healthCheckEligible: true,
        healthPathPrefixes: ['/notebook/']
    },
    {
        id: 'aistudio',
        name: 'AI Studio',
        url: 'https://aistudio.google.com/welcome',
        hostname: 'aistudio.google.com',
        icon: 'aistudio',
        color: '#4285f4',
        surface: 'ai',
        registryEligible: true,
        healthCheckEligible: true,
        healthPathPrefixes: ['/prompts/']
    },
    {
        id: 'youtube',
        name: 'YouTube',
        url: 'https://www.youtube.com/',
        hostname: 'www.youtube.com',
        icon: 'youtube',
        color: '#ff0033',
        surface: 'site',
        registryEligible: true,
        healthCheckEligible: false,
        healthPathPrefixes: []
    },
    {
        id: 'gdrive',
        name: 'Google Drive',
        url: 'https://drive.google.com/drive/my-drive',
        hostname: 'drive.google.com',
        icon: 'gdrive',
        color: '#1a73e8',
        surface: 'pdf',
        registryEligible: false,
        healthCheckEligible: false,
        healthPathPrefixes: []
    }
]

export const GOOGLE_AI_WEB_APPS = GOOGLE_WEB_SESSION_APPS.filter((app) => app.healthCheckEligible)
export const DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS = GOOGLE_WEB_SESSION_APPS.map((app) => app.id)
export const GOOGLE_WEB_SESSION_REGISTRY_IDS = GOOGLE_WEB_SESSION_APPS
    .filter((app) => app.registryEligible)
    .map((app) => app.id)
export const GOOGLE_DRIVE_WEB_APP = GOOGLE_WEB_SESSION_APPS.find((app) => app.id === 'gdrive') || GOOGLE_WEB_SESSION_APPS[0]
export const PRIMARY_GOOGLE_AI_WEB_APP = GOOGLE_AI_WEB_APPS[0]
