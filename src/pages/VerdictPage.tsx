import React, { useMemo, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import styles from './VerdictPage.module.css'

const VCFG = {
  REAL: {
    label: 'AUTHENTIC MEDIA', cls: 'glow-text-green', color: 'var(--green)',
    glow: 'rgba(0,255,157,0.05)', desc: 'All forensic algorithms return clean signals — no manipulation detected.',
    barW: (s: number) => Math.min(16, s),
  },
  INCONCLUSIVE: {
    label: 'INCONCLUSIVE', cls: 'glow-text-amber', color: 'var(--amber)',
    glow: 'rgba(255,184,0,0.05)', desc: 'Borderline forensic signal — manual expert review recommended.',
    barW: (s: number) => s,
  },
  LIKELY_SYNTHETIC: {
    label: 'LIKELY SYNTHETIC', cls: 'glow-text-orange', color: 'var(--orange)',
    glow: 'rgba(255,119,0,0.05)', desc: 'Multiple forensic modules triggered — manipulation artifacts present.',
    barW: (s: number) => s,
  },
  HIGH_CONFIDENCE_SYNTHETIC: {
    label: 'DEEPFAKE DETECTED', cls: 'glow-text-red', color: 'var(--red)',
    glow: 'rgba(255,34,68,0.06)', desc: 'All forensic pathways triggered — high-confidence synthetic manipulation confirmed.',
    barW: (s: number) => s,
  },
} as const

const RADIUS = 74
const CIRCUM = 2 * Math.PI * RADIUS

const VerdictPage: React.FC = () => {
  const navigate = useNavigate()
  const { result, fileData } = useAnalysis()
  const [barW, setBarW] = useState(0)
  const [ringPct, setRingPct] = useState(0)
  const animated = useRef(false)

  const scanMeta = useMemo(() => ({
    id: `AGS-${Date.now().toString(36).toUpperCase().slice(-8)}`,
    ts: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }),
  }), [])

  if (!result) { navigate('/upload'); return null }

  const cfg = VCFG[result.verdict]
  const modality = fileData?.modality || 'IMAGE'
  const modalIcon = modality === 'VIDEO' ? '🎬' : modality === 'AUDIO' ? '🎵' : '🖼'
  const statALabel = modality === 'AUDIO' ? 'SPECTRAL SCORE' : 'ELA + EDGE SCORE'
  const statBLabel = modality === 'AUDIO' ? 'FORMANT SCORE' : modality === 'VIDEO' ? 'TEMPORAL SCORE' : 'VARIANCE + HF'
  const statAColor = '#7C6FD4'
  const statBColor = '#8B5CF6'

  // Animate on mount
  useEffect(() => {
    if (animated.current) return
    animated.current = true
    const id = setTimeout(() => {
      setBarW(cfg.barW(result.ensemble_score))
      setRingPct(result.ensemble_score)
    }, 120)
    return () => clearTimeout(id)
  }, [cfg, result.ensemble_score])

  const dash = CIRCUM * (1 - ringPct / 100)

  return (
    <div className={`fade-in ${styles.page}`}
      style={{ ['--verdict-glow' as string]: cfg.glow, ['--verdict-color' as string]: cfg.color } as React.CSSProperties}>

      <div className={styles.card}
        style={{ ['--verdict-color' as string]: cfg.color, ['--verdict-glow' as string]: cfg.glow } as React.CSSProperties}>

        {/* Modality badge */}
        <div className={styles.modalityBadge}>
          <span>{modalIcon}</span>
          <span>{modality} FORENSIC ANALYSIS · AEGIS v1.0</span>
        </div>

        {/* Verdict headline */}
        <h1 className={`orbitron pulse-animation ${cfg.cls} ${styles.verdictTitle}`}>{cfg.label}</h1>
        <p className={styles.verdictDesc}>{cfg.desc}</p>

        {/* Animated ring */}
        <div className={styles.ringWrap}>
          <svg width="180" height="180" viewBox="0 0 180 180">
            {/* track */}
            <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
            {/* animated arc */}
            <circle cx="90" cy="90" r={RADIUS} fill="none"
              stroke={cfg.color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${CIRCUM}`}
              strokeDashoffset={`${dash}`}
              transform="rotate(-90 90 90)"
              style={{ transition:'stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1)', filter:`drop-shadow(0 0 10px ${cfg.color})` }}
            />
          </svg>
          <div className={styles.ringInner}>
            <div className={`${styles.ringScore} ${cfg.cls}`}>{result.ensemble_score}%</div>
            <div className={styles.ringLabel}>MANIPULATION</div>
          </div>
        </div>

        {/* Bar */}
        <div className={styles.barLabel}>AUTHENTICITY SPECTRUM</div>
        <div className={styles.barWrap}>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width:`${barW}%`, background:cfg.color, boxShadow:`0 0 12px ${cfg.color}` }} />
          </div>
          <div className={styles.barEnds}><span>AUTHENTIC</span><span>SYNTHETIC</span></div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{statALabel}</span>
            <div className={styles.statVal} style={{ color: statAColor }}>{result.spatial_score}%</div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{statBLabel}</span>
            <div className={styles.statVal} style={{ color: statBColor }}>{result.temporal_score}%</div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>INFERENCE TIME</span>
            <div className={styles.statVal}>{result.inference_ms}ms</div>
          </div>
        </div>

        {/* Summary */}
        <div className={styles.summary}
          style={{ background:`color-mix(in srgb, ${cfg.color} 5%, transparent)`, border:`1px solid color-mix(in srgb, ${cfg.color} 20%, transparent)` }}>
          {result.summary}
        </div>

        {/* Meta */}
        <div className={styles.meta}>
          <span>SCAN {scanMeta.id}</span>
          <span>Browser-native</span>
          <span>{scanMeta.ts}</span>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {modality !== 'AUDIO' && (
            <button className={`hud-button ${result.verdict !== 'REAL' ? 'hud-button-red' : ''}`}
              onClick={() => navigate('/heatmap')}>
              VIEW HEATMAP
            </button>
          )}
          <button className="hud-button" onClick={() => navigate('/forensic')}>FORENSIC REPORT</button>
          <button className="hud-button" onClick={() => navigate('/upload')}>NEW SCAN</button>
        </div>
      </div>
    </div>
  )
}

export default VerdictPage
