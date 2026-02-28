import React from 'react'
import { useLanguage } from '@src/app/providers'

/**
 * Shared splash-style loader used for webview/site transitions.
 */
const AestheticLoader: React.FC = () => {
    const { t } = useLanguage()

    return (
        <div className="aesthetic-loader-modern">
            <div className="ambient" />
            <div className="grid" />

            <div className="shell">
                <section className="brand">
                    <div className="markWrap">
                        <div className="markGlow" />
                        <svg className="mark" viewBox="0 0 56 56" aria-hidden="true">
                            <defs>
                                <linearGradient id="loaderRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#4fd1ff" />
                                    <stop offset="52%" stopColor="#8af8ca" />
                                    <stop offset="100%" stopColor="#ffcc78" />
                                </linearGradient>
                            </defs>
                            <circle
                                cx="28"
                                cy="28"
                                r="24"
                                fill="none"
                                stroke="url(#loaderRingGradient)"
                                strokeWidth="3.5"
                            />
                            <path
                                d="M12 30 H20 L23 22 L28 35 L33 16 L37 39 L40 30 H45"
                                fill="none"
                                stroke="#ebf8ff"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>

                    <div>
                        <h2 className="title">{t('app_name')}</h2>
                        <p className="subtitle">{t('splash_initializing')}</p>
                    </div>
                </section>

                <div className="meter">
                    <div className="meterBar" />
                </div>

                <section className="statusRow">
                    <div className="statusDot" />
                    <p className="statusText">{t('loader_syncing')}</p>
                </section>
            </div>
        </div>
    )
}

export default AestheticLoader
