import React from 'react'
import { useNavigate } from 'react-router-dom'

const TIERS = [
  {
    name: 'FREE CORE',
    price: '$0',
    sub: 'Forever · MIT License',
    color: 'var(--safe-green)',
    border: 'rgba(0,255,136,0.25)',
    bg: 'rgba(0,255,136,0.04)',
    features: [
      'Unlimited in-browser scans',
      'ELA + Edge + Variance + HF engine',
      'GradCAM-style heatmap overlay',
      'Forensic report download',
      'Chrome Extension included',
      'Full source on GitHub',
    ],
    cta: 'GET STARTED FREE',
    ctaAction: '/upload',
  },
  {
    name: 'PRO API',
    price: '$29',
    sub: 'per month  ·  or 500 BRK/mo',
    color: 'var(--cyan-primary)',
    border: 'rgba(0,245,255,0.30)',
    bg: 'rgba(0,245,255,0.04)',
    features: [
      'FastAPI server-side analysis',
      'Full ELA + FFT + Color + Texture modules',
      'GradCAM PNG artifacts in response',
      '10,000 API calls / month',
      'Pydantic JSON schema response',
      'SHA-256 + request_id audit trail',
      'Pay with BRK tokens (1 BRK = 10 calls)',
    ],
    cta: 'PAY WITH BRK',
    highlight: true,
  },
  {
    name: 'ENTERPRISE',
    price: '$299',
    sub: 'per month  ·  or pay-per-call on-chain',
    color: '#a78bfa',
    border: 'rgba(167,139,250,0.25)',
    bg: 'rgba(167,139,250,0.04)',
    features: [
      'Everything in Pro API',
      'Unlimited API calls',
      'Custom ONNX model fine-tuning',
      'Private HuggingFace deployment',
      'Video + audio modality support',
      'On-chain pay-per-call via BRK smart contract',
      'SLA + dedicated support',
    ],
    cta: 'CONTACT TEAM',
  },
]

const BRK_INFO = [
  { label: 'Token', value: 'BRK (BigRock Exchange)' },
  { label: 'Network', value: 'Ethereum / Polygon' },
  { label: 'Contract', value: 'APIPayment.sol (Hardhat)' },
  { label: 'Rate', value: '1 BRK = 10 API calls' },
  { label: 'Sponsor', value: 'BigRock Exchange — RockVerse 2026' },
]

const PricingPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="fade-in" style={{ padding: '32px 28px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '10px', fontFamily: 'Share Tech Mono', color: 'var(--cyan-primary)', letterSpacing: '.14em', marginBottom: '10px' }}>
          AEGIS PRICING
        </div>
        <h1 className="orbitron glow-text-cyan" style={{ fontSize: '28px', marginBottom: '12px' }}>
          Open-source at the core.<br />Monetized through BRK.
        </h1>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: '13px', maxWidth: '540px', margin: '0 auto', lineHeight: '1.65' }}>
          The browser-native forensic engine is free forever. Power users pay via the AEGIS FastAPI — using fiat or BRK tokens from BigRock Exchange.
        </p>
      </div>

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '48px' }}>
        {TIERS.map((t) => (
          <div key={t.name} style={{
            border: `1px solid ${t.border}`, borderRadius: '12px', padding: '28px 24px',
            background: t.bg, position: 'relative',
          }}>
            {t.highlight && (
              <div style={{
                position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                background: 'var(--cyan-primary)', color: '#001020', fontSize: '9px',
                fontFamily: 'Share Tech Mono', fontWeight: 700, padding: '3px 14px', borderRadius: '20px',
                letterSpacing: '.08em',
              }}>MOST POPULAR · BRK ENABLED</div>
            )}
            <div style={{ marginBottom: '6px', fontSize: '10px', color: t.color, fontFamily: 'Share Tech Mono', letterSpacing: '.12em' }}>
              {t.name}
            </div>
            <div style={{ fontSize: '36px', fontFamily: 'Share Tech Mono', fontWeight: 500, color: t.color, lineHeight: 1, marginBottom: '4px' }}>
              {t.price}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', marginBottom: '22px' }}>
              {t.sub}
            </div>
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '18px', marginBottom: '22px' }}>
              {t.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '9px', fontSize: '12px', alignItems: 'flex-start' }}>
                  <span style={{ color: t.color, flexShrink: 0, marginTop: '1px' }}>✓</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              className="hud-button"
              style={{ width: '100%', borderColor: t.color, color: t.color, padding: '10px' }}
              onClick={() => { if (t.ctaAction) navigate(t.ctaAction); else if (t.name === "ENTERPRISE") window.open("mailto:brainbyte.team@gmail.com?subject=AEGIS Enterprise", "_blank"); }}
            >
              {t.cta}
            </button>
          </div>
        ))}
      </div>

      {/* BRK Token section */}
      <div className="hud-panel" style={{ padding: '28px 32px', borderRadius: '12px', marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'Share Tech Mono', color: 'var(--cyan-primary)', letterSpacing: '.14em', marginBottom: '8px' }}>
              BRK TOKEN INTEGRATION
            </div>
            <h2 className="orbitron" style={{ fontSize: '20px', marginBottom: '12px', color: '#e0f7ff' }}>
              Pay-per-call on BigRock Exchange
            </h2>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: '12px', lineHeight: '1.7', marginBottom: '18px' }}>
              AEGIS integrates with BigRock Exchange's BRK token for on-chain pay-per-call API access. Enterprises running high-volume deepfake scanning can purchase API quota directly on-chain — no credit card, no subscription lock-in.
            </p>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: '11px', color: 'var(--text-muted)', padding: '12px 16px',
              background: 'rgba(0,245,255,0.04)', border: '1px solid var(--cyan-muted)', borderRadius: '6px',
              marginBottom: '16px' }}>
              <div style={{ color: 'var(--cyan-primary)', marginBottom: '6px', fontSize: '10px', letterSpacing: '.08em' }}>
                MOCK CONTRACT (APIPayment.sol)
              </div>
              <div>function purchaseQuota(uint256 amount) external {'{'}</div>
              <div style={{ paddingLeft: '16px' }}>brkToken.transferFrom(msg.sender, treasury, amount);</div>
              <div style={{ paddingLeft: '16px' }}>quotaBalance[msg.sender] += amount * CALLS_PER_TOKEN;</div>
              <div style={{ paddingLeft: '16px' }}>emit QuotaPurchased(msg.sender, amount);</div>
              <div>{'}'}</div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>
              Full Hardhat + Ethers.js integration in Round 2 sprint · MIT License
            </div>
          </div>
          <div>
            {BRK_INFO.map(({ label, value }) => (
              <div key={label} style={{
                display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px',
                padding: '9px 0', borderBottom: '1px solid rgba(0,245,255,0.08)',
                fontFamily: 'Share Tech Mono', fontSize: '12px',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color: 'var(--text-white)' }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: '20px' }}>
              <button className="hud-button" style={{ width: '100%', borderColor: 'var(--cyan-primary)', padding: '10px', fontSize: '11px' }} onClick={() => window.open('https://www.bigrock.in', '_blank')}>
                VIEW ON BIGROCK EXCHANGE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: 'center', padding: '24px', border: '1px solid var(--cyan-muted)', borderRadius: '12px', background: 'rgba(0,245,255,0.02)' }}>
        <div className="orbitron glow-text-cyan" style={{ fontSize: '16px', marginBottom: '8px' }}>
          Built for journalists. Free for citizens. Designed for India.
        </div>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: '12px', marginBottom: '20px' }}>
          The Free Core plan never expires. No account required. No data uploaded. Just open the app and scan.
        </p>
        <button className="hud-button" onClick={() => navigate('/upload')} style={{ padding: '11px 32px', fontSize: '12px' }}>
          START SCANNING FOR FREE
        </button>
      </div>

    </div>
  )
}

export default PricingPage
