import React, { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import styles from './UploadPage.module.css'

type Modality = 'IMAGE' | 'VIDEO' | 'AUDIO'

const CFG: Record<Modality, {
  icon: string; label: string; color: string;
  formats: string[]; accept: string; desc: string; tip: string;
}> = {
  IMAGE: {
    icon: '🖼', label: 'IMAGE', color: 'var(--cyan)',
    formats: ['JPEG', 'PNG', 'WebP', 'GIF', 'BMP'],
    accept: 'image/*',
    desc: 'Error Level Analysis · Laplacian edges · Block variance · HF spectral fingerprint · GradCAM heatmap',
    tip: 'Right-click any image on any webpage to scan it with AEGIS',
  },
  VIDEO: {
    icon: '🎬', label: 'VIDEO', color: 'var(--violet)',
    formats: ['MP4', 'WebM', 'MOV', 'AVI'],
    accept: 'video/*',
    desc: 'Frame extraction · Per-frame ELA · Temporal consistency · Confidence timeline across all frames',
    tip: 'Analyzes up to 20 frames — best with portrait/face-forward video',
  },
  AUDIO: {
    icon: '🎵', label: 'AUDIO', color: 'var(--green)',
    formats: ['MP3', 'WAV', 'OGG', 'AAC', 'FLAC'],
    accept: 'audio/*',
    desc: 'Spectral flatness · F1/F2/F3 formant tracking · HF energy ratio · Silence gap pattern analysis',
    tip: 'Works with voice recordings — detects AI TTS and voice cloning',
  },
}

const UploadPage: React.FC = () => {
  const navigate = useNavigate()
  const { setFileData, setResult } = useAnalysis()
  const [modality, setModality] = useState<Modality>('IMAGE')
  const [isDragging, setIsDragging]     = useState(false)
  const [localFile, setLocalFile]       = useState<File | null>(null)
  const [corsError, setCorsError]       = useState(false)
  const [showDemo, setShowDemo]         = useState(false)
  const cfg = CFG[modality]

  const handleFile = useCallback((file: File, forced?: Modality) => {
    const isI = file.type.startsWith('image/')
    const isV = file.type.startsWith('video/')
    const isA = file.type.startsWith('audio/')
    if (!isI && !isV && !isA) { alert('Unsupported file type.'); return }
    const det: Modality = forced ?? (isV ? 'VIDEO' : isA ? 'AUDIO' : 'IMAGE')
    setModality(det)
    setLocalFile(file)
    setFileData({ file, name: file.name, size: (file.size/1024/1024).toFixed(2)+' MB', type: file.type, previewUrl: URL.createObjectURL(file), modality: det })
    setResult(null); setCorsError(false)
  }, [setFileData, setResult])

  // scanUrl from Chrome Extension
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const u = p.get('scanUrl')
    if (!u) return
    window.history.replaceState({}, '', window.location.pathname)
    fetch(u, { mode: 'cors' })
      .then(r => r.blob())
      .then(blob => { const ext = u.split('.').pop()?.toLowerCase()||'png'; handleFile(new File([blob], `scanned.${ext}`, { type: blob.type||`image/${ext}` })) })
      .catch(() => setCorsError(true))
  }, [handleFile])

  // Right-click context menu
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName.toLowerCase() !== 'img') return
      e.preventDefault()
      if (!window.confirm('Analyze this image with AEGIS?')) return
      fetch((t as HTMLImageElement).src, { mode:'cors' })
        .then(r => r.blob()).then(b => handleFile(new File([b], 'ctx.png', { type: b.type||'image/png' })))
        .catch(() => setCorsError(true))
    }
    document.addEventListener('contextmenu', h)
    return () => document.removeEventListener('contextmenu', h)
  }, [handleFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const switchModality = (m: Modality) => { setModality(m); setLocalFile(null); setFileData(null) }

  const demoFake = () => { setFileData(null); setResult(null); sessionStorage.setItem('aegis_demo_mode','FAKE'); sessionStorage.setItem('aegis_demo_modality',modality); setShowDemo(false); navigate('/scanning') }
  const demoReal = () => { setFileData(null); setResult(null); sessionStorage.setItem('aegis_demo_mode','REAL'); sessionStorage.setItem('aegis_demo_modality',modality); setShowDemo(false); navigate('/scanning') }

  const color = cfg.color

  return (
    <div className={`fade-in ${styles.page}`}>
      <div className={styles.particles} />

      {/* CORS toast */}
      {corsError && (
        <div style={{ position:'fixed', top:'64px', left:'50%', transform:'translateX(-50%)', zIndex:1000,
          background:'var(--red-glow)', border:'1px solid var(--red)', color:'var(--red)',
          padding:'10px 22px', borderRadius:'var(--r-sm)', fontSize:'12px', fontFamily:'Share Tech Mono' }}>
          CORS blocked — save the image and upload it directly.
        </div>
      )}

      {/* Demo panel */}
      {showDemo && (
        <div className={styles.demoOverlay} onClick={() => setShowDemo(false)}>
          <div className={styles.demoPanel} onClick={e => e.stopPropagation()}>
            <div className={`glow-text-cyan ${styles.demoTitle}`}>DEMO MODE</div>
            <p className={styles.demoSub}>{cfg.icon} {modality} forensics · Pre-loaded samples</p>
            <div className={styles.demoCards}>
              <button className={styles.demoCard} style={{ borderColor:'var(--red)', color:'var(--red)' }} onClick={demoFake}>
                <div className={styles.demoCardIcon}>🔴</div>
                <div className={styles.demoCardLabel}>DEEPFAKE SAMPLE</div>
                <div className={styles.demoCardSub}>HIGH CONFIDENCE SYNTHETIC<br/>94% manipulation probability</div>
              </button>
              <button className={styles.demoCard} style={{ borderColor:'var(--green)', color:'var(--green)' }} onClick={demoReal}>
                <div className={styles.demoCardIcon}>✅</div>
                <div className={styles.demoCardLabel}>AUTHENTIC SAMPLE</div>
                <div className={styles.demoCardSub}>AUTHENTIC MEDIA<br/>8% manipulation probability</div>
              </button>
            </div>
            <button className="hud-button" style={{ fontSize:'10px', opacity:.55 }} onClick={() => setShowDemo(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Header */}
      <p className={styles.kicker}>AEGIS FORENSIC ANALYSIS STUDIO · v1.0</p>
      <h1 className={styles.title}>Select your media type</h1>
      <p className={styles.sub}>All analysis runs 100% in-browser — no upload, no server, no privacy risk</p>

      {/* Modality tabs */}
      <div className={styles.tabs}>
        {(Object.keys(CFG) as Modality[]).map(m => {
          const c = CFG[m]; const active = modality === m
          return (
            <button key={m} className={`${styles.tab} ${active?styles.active:''}`}
              style={{ ['--tab-color' as string]: c.color } as React.CSSProperties}
              onClick={() => switchModality(m)}>
              <span className={styles.tabIcon}>{c.icon}</span>
              <span className={styles.tabLabel}>{c.label}</span>
              <span className={styles.tabFormats}>{c.formats.slice(0,3).join(' · ')}</span>
            </button>
          )
        })}
      </div>

      {/* Description */}
      <div className={styles.descStrip} style={{ background:`color-mix(in srgb, ${color} 5%, transparent)`, border:`1px solid color-mix(in srgb, ${color} 20%, transparent)` }}>
        <span style={{ fontSize:'20px' }}>{cfg.icon}</span>
        <span>{cfg.desc}</span>
      </div>

      {/* Drop zone */}
      <div className={`${styles.zone} ${isDragging?styles.dragging:''}`}
        style={{ ['--zone-color' as string]: color } as React.CSSProperties}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}>

        {!localFile ? (
          <div className={styles.dropContent}>
            <div className={styles.dropIcon}>{cfg.icon}</div>
            <div>
              <div className={styles.dropTitle}>Drop {modality.toLowerCase()} file here</div>
              <div className={styles.dropSub}>{cfg.formats.join(' · ')} supported</div>
            </div>
            <input type="file" id="fileInput" style={{ display:'none' }}
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
              accept={cfg.accept} />
            <div className={styles.btnRow}>
              <button className="hud-button"
                style={{ borderColor:color, color }}
                onClick={() => document.getElementById('fileInput')?.click()}>
                SELECT FILE
              </button>
              <button className="hud-button" onClick={() => setShowDemo(true)}>RUN DEMO</button>
            </div>
            <p className={styles.tip}>{cfg.tip}</p>
          </div>
        ) : (
          <div className={styles.previewContent}>
            {modality === 'IMAGE' && (
              <img src={URL.createObjectURL(localFile)} alt="Preview" className={styles.previewImage} />
            )}
            {modality === 'VIDEO' && (
              <video src={URL.createObjectURL(localFile)} controls muted
                style={{ maxHeight:'160px', maxWidth:'100%', borderRadius:'var(--r-sm)', border:`1px solid ${color}60` }} />
            )}
            {modality === 'AUDIO' && (
              <div style={{ textAlign:'center', padding:'16px' }}>
                <div style={{ fontSize:'32px', marginBottom:'10px' }}>🎵</div>
                <audio src={URL.createObjectURL(localFile)} controls style={{ width:'100%' }} />
              </div>
            )}
            <div className={styles.fileInfo}>
              <p style={{ color }}><strong>NAME</strong><br/>{localFile.name}</p>
              <p style={{ color }}><strong>SIZE</strong><br/>{(localFile.size/1024/1024).toFixed(2)} MB</p>
              <p><strong>TYPE</strong><br/>{localFile.type}</p>
              <p><strong>MODALITY</strong><br/>{modality}</p>
            </div>
            <div className={styles.btnRow}>
              <button className="hud-button" style={{ borderColor:color, color }}
                onClick={() => navigate('/scanning')}>
                INITIATE SCAN
              </button>
              <button className="hud-button" onClick={() => { setLocalFile(null); setFileData(null) }}>CLEAR</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UploadPage
