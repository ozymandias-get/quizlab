import { useQueryClient } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { useElectronQuery, useElectronMutation } from '../useElectron'
import type {
    QuizSettings,
    QuizGenerateResult,
    QuizAuthResult,
    QuizActionResult
} from '@shared/types'
import { useToast } from '@src/app/providers/ToastContext'
import { useLanguage } from '@src/app/providers/LanguageContext'

export const QUIZ_SETTINGS_KEY = ['quiz', 'settings']
export const QUIZ_AUTH_KEY = ['quiz', 'auth']

/**
 * Quiz Settings Query
 */
export function useQuizSettings() {
    return useElectronQuery<QuizSettings>({
        key: QUIZ_SETTINGS_KEY,
        queryFn: (api) => api.quiz.getSettings(),
        options: {
            staleTime: 1000 * 60 * 60 // 1 hour
        }
    })
}

/**
 * Quiz Auth Check Query
 * staleTime: 0 ensures polling always fetches fresh data when refetchInterval is active.
 */
export function useCheckAuth(options?: Omit<UseQueryOptions<QuizAuthResult, Error, QuizAuthResult>, 'queryKey' | 'queryFn'>) {
    return useElectronQuery<QuizAuthResult>({
        key: QUIZ_AUTH_KEY,
        queryFn: (api) => api.quiz.checkAuth(),
        options: {
            staleTime: 0,  // Always fresh when polling
            retry: false,
            ...options
        }
    })
}

/**
 * Save Quiz Settings Mutation
 */
export function useSaveSettings() {
    const queryClient = useQueryClient()
    const { showSuccess } = useToast()
    const { t } = useLanguage()

    return useElectronMutation<boolean, Partial<QuizSettings>>(
        (api, settings) => api.quiz.saveSettings(settings),
        {
            errorMessage: t('toast_settings_save_failed'),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: QUIZ_SETTINGS_KEY })
                showSuccess(t('toast_settings_saved'), t('toast_config_saved'))
            }
        }
    )
}

/**
 * Generate Quiz Mutation
 * Exposes isPending for long running operations
 */
export function useGenerateQuiz() {
    const { t } = useLanguage()
    return useElectronMutation<QuizGenerateResult, Record<string, unknown>>(
        (api, params) => api.quiz.generate(params),
        {
            errorMessage: t('toast_gen_quiz_failed'),
            // isPending is available on the returned object from the hook
        }
    )
}

/**
 * Ask AI Assistant Mutation
 */
export function useAskAssistant() {
    const { t } = useLanguage()
    return useElectronMutation<{ success: boolean; data?: unknown; error?: string }, { question: string, context?: string }>(
        (api, { question, context }) => api.quiz.askAssistant(question, context),
        {
            errorMessage: t('toast_ai_response_failed')
        }
    )
}

/**
 * Open Gemini Login Mutation
 */
export function useOpenLogin() {
    const { t } = useLanguage()
    return useElectronMutation<QuizActionResult, void>(
        (api) => api.quiz.openLogin(),
        {
            errorMessage: t('toast_login_open_failed')
        }
    )
}


/**
 * Logout Mutation
 */
export function useLogout() {
    const queryClient = useQueryClient()
    const { showSuccess } = useToast()
    const { t } = useLanguage()

    return useElectronMutation<QuizActionResult, void>(
        (api) => api.quiz.logout(),
        {
            errorMessage: t('toast_logout_failed'),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: QUIZ_AUTH_KEY })
                showSuccess(t('toast_logout_success'), t('toast_auth_title'))
            }
        }
    )
}

export const QUIZ_CLI_PATH_KEY = ['quiz', 'cliPath']

/**
 * Get CLI Path Query
 */
export function useCliPath() {
    return useElectronQuery<{ path: string; exists: boolean }>({
        key: QUIZ_CLI_PATH_KEY,
        queryFn: (api) => api.quiz.getCliPath(),
        options: {
            staleTime: Infinity,
            gcTime: Infinity
        }
    })
}

