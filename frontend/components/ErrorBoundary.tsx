import React from 'react'
import { useLanguage } from '../context/LanguageContext'

/**
 * Global Hata Yakalayıcı (Error Boundary)
 * Uygulamanın veya belirli bir bölümün çökmesini engeller ve şık bir hata ekranı gösterir.
 */
interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: (error: Error, retry: () => void) => React.ReactNode;
    title?: string;
    onReset?: () => void;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryWrapperProps extends ErrorBoundaryProps {
    t?: (key: string) => string; // To allow passing 't' manually if needed, or inferred from usage
}

function ErrorBoundary(props: ErrorBoundaryWrapperProps) {
    const { t } = useLanguage()
    return <ErrorBoundaryClass {...props} t={t} />
}

interface ErrorBoundaryClassProps extends ErrorBoundaryWrapperProps {
    t: (key: string) => string;
}

interface ErrorBoundaryClassState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

class ErrorBoundaryClass extends React.Component<ErrorBoundaryClassProps, ErrorBoundaryClassState> {
    constructor(props: ErrorBoundaryClassProps) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo)
        this.setState({ errorInfo })
        if (this.props.onError) {
            this.props.onError(error, errorInfo)
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        if (this.props.onReset) {
            this.props.onReset()
        }
    }

    render() {
        const { t } = this.props
        if (this.state.hasError) {
            if (this.props.fallback && this.state.error) {
                return this.props.fallback(this.state.error, this.handleRetry)
            }

            return (
                <div className="flex flex-col items-center justify-center w-full h-full min-h-[200px] p-6 text-center select-text bg-stone-900/50 backdrop-blur-sm rounded-xl border border-red-500/20">
                    <div className="w-12 h-12 mb-4 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 animate-pulse">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>

                    <h3 className="text-lg font-bold text-stone-200 mb-2">
                        {this.props.title || t('error_boundary_title')}
                    </h3>

                    <p className="text-sm text-stone-400 mb-6 max-w-sm mx-auto">
                        {this.state.error?.message || t('unexpected_error')}
                    </p>

                    <button
                        onClick={this.handleRetry}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('try_again')}
                    </button>

                    <details className="mt-8 text-left w-full max-w-md bg-black/20 p-3 rounded-lg border border-white/5">
                        <summary className="text-xs text-stone-500 cursor-pointer hover:text-stone-300 transition-colors uppercase font-bold tracking-widest">{t('technical_details')}</summary>
                        <pre className="mt-2 text-[10px] text-red-300/70 overflow-x-auto whitespace-pre-wrap font-mono p-4 rounded-lg bg-black/40">
                            {this.state.errorInfo?.componentStack || t('no_stack_trace')}
                        </pre>
                    </details>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary

