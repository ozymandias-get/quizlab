import { ConfigManager } from '../../core/ConfigManager'
import type { GeminiWebSessionStatus } from '@shared-core/types'
import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '../../../shared/constants/google-ai-web-apps'
import { FEATURE_ENABLED, DEFAULT_USER_ENABLED, isReasonCode, isSessionState } from './sessionConfig'
import { createDefaultStatus } from './stateMachine'

export interface SessionMetadata extends GeminiWebSessionStatus {
    accountHash: string | null;
}

export class SessionMetadataManager {
    private readonly manager: ConfigManager<SessionMetadata>

    constructor(configPath: string) {
        this.manager = new ConfigManager<SessionMetadata>(configPath)
    }

    async read(): Promise<SessionMetadata> {
        const raw = await this.manager.read()
        const fallback = createDefaultStatus(
            FEATURE_ENABLED,
            FEATURE_ENABLED ? DEFAULT_USER_ENABLED : false
        )
        const enabledAppIds = Array.isArray(raw.enabledAppIds)
            ? raw.enabledAppIds.filter((value): value is string => typeof value === 'string' && GOOGLE_WEB_SESSION_REGISTRY_IDS.includes(value as typeof GOOGLE_WEB_SESSION_REGISTRY_IDS[number]))
            : [...GOOGLE_WEB_SESSION_REGISTRY_IDS]

        return {
            accountHash: typeof raw.accountHash === 'string' ? raw.accountHash : null,
            state: typeof raw.state === 'string' && isSessionState(raw.state) ? raw.state : fallback.state,
            lastHealthyAt: typeof raw.lastHealthyAt === 'string' ? raw.lastHealthyAt : null,
            lastCheckAt: typeof raw.lastCheckAt === 'string' ? raw.lastCheckAt : null,
            consecutiveFailures: Number.isFinite(raw.consecutiveFailures) ? Number(raw.consecutiveFailures) : 0,
            reasonCode: typeof raw.reasonCode === 'string' && isReasonCode(raw.reasonCode) ? raw.reasonCode : fallback.reasonCode,
            featureEnabled: FEATURE_ENABLED,
            enabled: typeof raw.enabled === 'boolean'
                ? (FEATURE_ENABLED ? raw.enabled : false)
                : fallback.enabled,
            enabledAppIds
        }
    }

    async write(status: GeminiWebSessionStatus, accountHash: string | null): Promise<SessionMetadata> {
        const nextMetadata: SessionMetadata = {
            ...status,
            accountHash
        }
        await this.manager.write(nextMetadata)
        return nextMetadata
    }

    toPublicStatus(metadata: SessionMetadata): GeminiWebSessionStatus {
        return {
            state: metadata.state,
            lastHealthyAt: metadata.lastHealthyAt,
            lastCheckAt: metadata.lastCheckAt,
            consecutiveFailures: metadata.consecutiveFailures,
            reasonCode: metadata.reasonCode,
            featureEnabled: FEATURE_ENABLED,
            enabled: metadata.enabled,
            enabledAppIds: metadata.enabledAppIds
        }
    }
}
