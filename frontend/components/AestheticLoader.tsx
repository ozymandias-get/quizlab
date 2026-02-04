import React from 'react'
import styled from 'styled-components'
import { useLanguage } from '../context'

/**
 * AI Geçiş Ekranı - New Pulse Heartbeat Loader
 * Premium transition screen between AI models.
 */
const AestheticLoader: React.FC = () => {
  const { t } = useLanguage()

  return (
    <StyledWrapper className="aesthetic-loader">
      <div className="heartbeat-container">
        <div className="heartbeat-aura" />
        <svg className="heartbeat-icon" viewBox="0 0 100 100">
          <path
            className="heartbeat-path"
            d="M0,50 L30,50 L35,30 L45,70 L55,10 L65,90 L70,50 L100,50"
          />
        </svg>
      </div>
      <div className="loader-text">{t('app_name')}</div>
      <div className="status-dot-container">
        <span className="status-dot"></span>
        <span className="status-text">{t('loader_syncing')}</span>
      </div>
    </StyledWrapper>
  )
}

const StyledWrapper = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(10, 10, 12, 0.9) 0%, rgba(5, 5, 7, 0.98) 100%);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  z-index: 100;
  overflow: hidden;

  .heartbeat-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .heartbeat-aura {
    position: absolute;
    width: 60px;
    height: 60px;
    background: radial-gradient(circle, #ff3366 0%, transparent 70%);
    border-radius: 50%;
    filter: blur(30px);
    opacity: 0.3;
    animation: auraPulse 1.5s ease-in-out infinite;
  }

  .heartbeat-icon {
    width: 80px;
    height: 80px;
    color: #ff3366;
    filter: drop-shadow(0 0 20px rgba(255, 51, 102, 0.4));
    z-index: 2;
  }

  .heartbeat-path {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: drawLine 2s ease-in-out forwards;
  }

  .loader-text {
    font-size: 1.8rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #ffffff 0%, #ffcbd5 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: heartbeatPulse 1.5s ease-in-out infinite;
  }

  .status-dot-container {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 1.5rem;
      opacity: 0.4;
  }

  .status-dot {
      width: 6px;
      height: 6px;
      background: #ff3366;
      border-radius: 50%;
      box-shadow: 0 0 10px #ff3366;
      animation: dotPulse 1.5s infinite;
  }

  .status-text {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: white;
  }

  @keyframes auraPulse {
    0%, 100% { transform: scale(1); opacity: 0.2; }
    10%, 30% { transform: scale(1.6); opacity: 0.5; }
  }

  @keyframes drawLine {
    to { stroke-dashoffset: 0; }
  }

  @keyframes heartbeatPulse {
    0%, 20%, 40%, 100% { transform: scale(1); }
    10% { transform: scale(1.05); }
    30% { transform: scale(1.03); }
  }

  @keyframes dotPulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.5); opacity: 1; }
  }

  .heartbeat-aura, .loader-text, .status-dot {
    will-change: transform, opacity;
  }
`

export default AestheticLoader

