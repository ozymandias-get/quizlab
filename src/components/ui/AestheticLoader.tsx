import React from 'react'
import styled from 'styled-components'
import { useLanguage } from '@src/app/providers'

/**
 * Shared splash-style loader used for webview/site transitions.
 */
const AestheticLoader: React.FC = () => {
    const { t } = useLanguage()

    return (
        <Wrapper className="aesthetic-loader">
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
        </Wrapper>
    )
}

const Wrapper = styled.div`
  --bg: #000000;
  --surface: rgba(7, 14, 24, 0.72);
  --surface-border: rgba(170, 220, 255, 0.22);
  --title: #f7fbff;
  --body: #a9bbcd;
  --accent-a: #4fd1ff;
  --accent-b: #ffcc78;
  --accent-c: #8af8ca;

  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  z-index: 100;
  background: var(--bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  pointer-events: none;

  * {
    box-sizing: border-box;
  }

  .ambient {
    position: absolute;
    inset: 0;
    background: #000000;
    animation: none;
  }

  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(132, 162, 190, 0.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(132, 162, 190, 0.07) 1px, transparent 1px);
    background-size: 34px 34px;
    mask-image: radial-gradient(circle at center, black 38%, transparent 95%);
    opacity: 0;
  }

  .shell {
    position: relative;
    width: min(640px, 90vw);
    border-radius: 24px;
    padding: 38px 36px 28px;
    display: flex;
    flex-direction: column;
    gap: 26px;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    box-shadow:
      0 32px 90px rgba(2, 10, 24, 0.72),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transform: translateY(6px);
    animation: shellEntrance 0.9s cubic-bezier(0.19, 1, 0.22, 1) forwards;
  }

  .shell::after {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: 23px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    pointer-events: none;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .markWrap {
    position: relative;
    height: 56px;
    width: 56px;
    flex: 0 0 auto;
  }

  .markGlow {
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(79, 209, 255, 0.42), transparent 68%);
    filter: blur(7px);
    animation: glowPulse 1.8s ease-in-out infinite;
  }

  .mark {
    position: relative;
    height: 56px;
    width: 56px;
    filter: drop-shadow(0 10px 20px rgba(1, 18, 38, 0.46));
  }

  .title {
    margin: 0;
    font-size: clamp(30px, 3.6vw, 42px);
    line-height: 1;
    letter-spacing: -0.03em;
    font-weight: 700;
    color: var(--title);
    background: linear-gradient(105deg, #ffffff 0%, #d3f0ff 45%, #ffe3b1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: titlePulse 2.2s ease-in-out infinite;
  }

  .subtitle {
    margin: 8px 0 0;
    color: var(--body);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-family: 'IBM Plex Mono', monospace;
  }

  .meter {
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(130, 160, 186, 0.18);
    border: 1px solid rgba(150, 186, 217, 0.2);
    position: relative;
  }

  .meter::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(79, 209, 255, 0.06),
      rgba(255, 204, 120, 0.06)
    );
  }

  .meterBar {
    height: 100%;
    width: 44%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent-a), var(--accent-c), var(--accent-b));
    box-shadow: 0 0 18px rgba(79, 209, 255, 0.5);
    transform: translateX(-110%);
    animation: barTravel 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .statusRow {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .statusDot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent-c);
    box-shadow: 0 0 12px rgba(138, 248, 202, 0.7);
    animation: dotPulse 1.4s ease-in-out infinite;
  }

  .statusText {
    margin: 0;
    color: #d2dfec;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  @keyframes ambientDrift {
    0% {
      transform: scale(1) translate3d(0, 0, 0);
    }

    100% {
      transform: scale(1.04) translate3d(-1.2%, 0.8%, 0);
    }
  }

  @keyframes shellEntrance {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.985);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes glowPulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.78;
    }

    50% {
      transform: scale(1.12);
      opacity: 0.4;
    }
  }

  @keyframes titlePulse {
    0%,
    100% {
      filter: brightness(1);
    }

    50% {
      filter: brightness(1.13);
    }
  }

  @keyframes barTravel {
    0% {
      transform: translateX(-110%);
    }

    65% {
      transform: translateX(142%);
    }

    100% {
      transform: translateX(142%);
    }
  }

  @keyframes dotPulse {
    0%,
    100% {
      transform: scale(1);
    }

    50% {
      transform: scale(1.24);
    }
  }
`

export default AestheticLoader
