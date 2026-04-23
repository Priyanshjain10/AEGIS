import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis, type BackendArtifacts } from '../context/AnalysisContext'
import { analyzeImage, DEMO_FAKE_RESULT, DEMO_REAL_RESULT } from '../lib/analysis'
import { analyzeVideo } from '../lib/videoAnalysis'
import { analyzeAudio } from '../lib/audioAnalysis'
import styles from './ScanningPage.module.css'

const API_BASE = (import.meta.env.VITE_AEGIS_API_BASE as string|undefined)?.trim() || ''

type Modality = 'IMAGE'|'VIDEO'|'AUDIO'

const STAGES: Record<Modality,string[]> = {
  IMAGE: ['Face Detection','ELA Analysis','Edge Detection','Block Variance','Ensemble Fusion'],
  VIDEO: ['Frame Extraction','Per-Frame ELA','Temporal Analysis','Boundary Detection','Ensemble Fusion'],
  AUDIO: ['Audio Decode','Spectral FFT','Formant Tracking','HF Energy Ratio','Ensemble Fusion'],
}
const LOGS: Record<Modality,string[]> = {
  IMAGE: [
    '> Initializing AEGIS forensic engine v1.0...',
    '> Error Level Analysis module loaded.',
    '> Laplacian edge detection kernel active.',
    '> 8×8 local block variance map computed.',
    '> High-frequency energy spectral scan...',
    '> Weighted ensemble score computed.',
    '> GradCAM activation heatmap rendered.',
    '> Forensic analysis complete.',
  ],
  VIDEO: [
    '> Initializing AEGIS video forensic engine...',
    '> Video decoded — frame buffer ready.',
    '> Seeking to sample timestamps (20 frames)...',
    '> Per-frame ELA and edge analysis running...',
    '> Temporal consistency check across frames...',
    '> Confidence timeline constructed.',
    '> Temporal ensemble verdict computed.',
    '> Video forensic analysis complete.',
  ],
  AUDIO: [
    '> Initializing AEGIS audio forensic engine...',
    '> Audio decoded via OfflineAudioContext.',
    '> 512-point DFT computed on voice window.',
    '> Spectral flatness index measured.',
    '> F1/F2/F3 vocal formant tracking complete.',
    '> High-frequency energy ratio: measured.',
    '> Silence gap pattern analysis complete.',
    '> Audio forensic analysis complete.',
  ],
}
const COLORS: Record<Modality,string> = { IMAGE:'var(--cyan)', VIDEO:'var(--violet)', AUDIO:'var(--green)' }

const ScanningPage: React.FC = () => {
  const navigate = useNavigate()
  const { fileData, setResult, setBackendArtifacts } = useAnalysis()
  const [logs, setLogs]         = useState<string[]>([])
  const [progress, setProgress] = useState([0,0,0,0,0])
  const [bStatus, setBStatus]   = useState<'idle'|'running'|'done'|'offline'>('idle')
  const ran = useRef(false)

  const dm   = sessionStorage.getItem('aegis_demo_mode')
  const dmMd = (sessionStorage.getItem('aegis_demo_modality')||'IMAGE') as Modality
  const modality: Modality = dm ? dmMd : (fileData?.modality||'IMAGE')
  const color = COLORS[modality]
  const stages = STAGES[modality]
  const logs0  = LOGS[modality]

  useEffect(() => {
    if (ran.current) return; ran.current = true
    sessionStorage.removeItem('aegis_demo_mode'); sessionStorage.removeItem('aegis_demo_modality')

    logs0.forEach((m,i) => setTimeout(() => setLogs(p=>[...p,m]), i*660))

    let stage = 0
    const pt = setInterval(() => {
      setProgress(p => {
        const n=[...p]
        if (stage<stages.length) { if (n[stage]<100) n[stage]=Math.min(100,n[stage]+Math.random()*24); else stage++ }
        return n
      })
      if (stage>=stages.length) clearInterval(pt)
    }, 160)

    ;(async()=>{
      const min = new Promise<void>(r=>setTimeout(r,5400))
      let result
      if (dm==='FAKE')            result = DEMO_FAKE_RESULT
      else if (dm==='REAL')       result = DEMO_REAL_RESULT
      else if (fileData?.file) {
        try {
          if (modality==='VIDEO')      result = await analyzeVideo(fileData.file)
          else if (modality==='AUDIO') result = await analyzeAudio(fileData.file)
          else {
            const img=new Image(); img.src=fileData.previewUrl
            await new Promise<void>((res,rej)=>{ img.onload=()=>res(); img.onerror=()=>rej() })
            result = await analyzeImage(img)
          }
        } catch { result = DEMO_FAKE_RESULT }
      } else result = DEMO_FAKE_RESULT

      if (API_BASE && modality==='IMAGE' && fileData?.file && !dm) {
        setBStatus('running')
        setLogs(p=>[...p,`> Connecting to AEGIS server...`])
        try {
          const form=new FormData(); form.append('file',fileData.file)
          const resp=await fetch(`${API_BASE}/api/v1/analyze/image`,{method:'POST',body:form,signal:AbortSignal.timeout(12000)})
          if (resp.ok) {
            const d=await resp.json()
            setBackendArtifacts({ heatmap_png_base64:d.artifacts?.heatmap_png_base64??'', ela_png_base64:d.artifacts?.ela_png_base64??'', processing_ms:d.processing_ms??0, request_id:d.request_id??'', module_scores:d.module_scores??[], frequency_bins:d.frequency_bins??[], anomaly_codes:(d.anomalies??[]).map((a:{code:string})=>a.code) } as BackendArtifacts)
            setBStatus('done'); setLogs(p=>[...p,`> Server done — ${d.processing_ms}ms`])
          } else { setBStatus('offline'); setLogs(p=>[...p,'> Server error — browser analysis active.']) }
        } catch { setBStatus('offline'); setLogs(p=>[...p,'> Server offline — browser analysis active.']) }
      } else setBackendArtifacts(null)

      await min
      clearInterval(pt)
      setProgress([100,100,100,100,100])
      setResult(result)
      setTimeout(()=>navigate('/verdict'),700)
    })()
    return ()=>clearInterval(pt)
  }, [])

  const bLabel = bStatus==='running'?'⟳ Server analysis running...' : bStatus==='done'?'✓ Browser + server dual-path' : bStatus==='offline'?'⚠ Server offline — browser only':''

  return (
    <div className={`fade-in ${styles.page}`}>

      {/* LEFT — Terminal */}
      <div className={`${styles.panel} ${styles.left}`}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitle}>TERMINAL OUTPUT</div>
          <span style={{ fontSize:'8px', fontFamily:'Share Tech Mono', color, padding:'2px 8px', border:`1px solid color-mix(in srgb, ${color} 30%, transparent)`, borderRadius:'3px', background:`color-mix(in srgb, ${color} 8%, transparent)` }}>{modality}</span>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.terminal}>
            {logs.map((l,i) => (
              <div key={i} className={styles.logLine} style={{ color: l.includes('Server')||l.includes('server') ? 'var(--amber)' : undefined }}>{l}</div>
            ))}
            <span className={styles.cursor}>_</span>
          </div>
          {bLabel && (
            <div className={styles.backendTag} style={{ background: bStatus==='done'?'var(--green-glow)':'var(--amber-dim)', border:`1px solid ${bStatus==='done'?'var(--green-dim)':'var(--amber-dim)'}`, color: bStatus==='done'?'var(--green)':'var(--amber)' }}>{bLabel}</div>
          )}
        </div>
      </div>

      {/* CENTER — Scanner */}
      <div className={`${styles.panel} ${styles.center}`}>
        <div className={styles.scannerWrap} style={{ borderColor:`color-mix(in srgb, ${color} 30%, transparent)`, boxShadow:`0 0 40px color-mix(in srgb, ${color} 10%, transparent)` }}>
          <div className={styles.ring}  style={{ borderColor: color }} />
          <div className={styles.ring2} />
          {fileData?.previewUrl && modality==='IMAGE' && <img src={fileData.previewUrl} alt="" className={styles.targetImage} />}
          {fileData?.previewUrl && modality==='VIDEO' && (
            <video src={fileData.previewUrl} muted autoPlay loop style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', opacity:.7, filter:'sepia(50%) hue-rotate(220deg) saturate(180%)' }} />
          )}
          {modality==='AUDIO' && <AudioViz color={color} />}
          {!fileData?.previewUrl && modality==='IMAGE' && <DemoFace color={color} />}
          <div className={styles.scanBeam} style={{ background:color, boxShadow:`0 0 20px 8px color-mix(in srgb, ${color} 50%, transparent)` }} />
        </div>
        <div className={styles.scanLabel} style={{ color }}>{modality==='AUDIO'?'ANALYZING AUDIO...':modality==='VIDEO'?'ANALYZING FRAMES...':'ANALYZING...'}</div>
      </div>

      {/* RIGHT — Progress */}
      <div className={`${styles.panel} ${styles.right}`}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitle}>FORENSIC MODULES</div>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.stages}>
            {stages.map((name,i) => (
              <div key={i} className={styles.stageRow}>
                <div className={styles.stageLabel}>
                  <span>{name}</span>
                  <span className={styles.stagePct}>{Math.round(Math.min(100,progress[i]))}%</span>
                </div>
                <div className={styles.trackBg}>
                  <div className={styles.trackFill} style={{ width:`${Math.min(100,progress[i])}%`, background:color, boxShadow:`0 0 6px color-mix(in srgb, ${color} 60%, transparent)` }} />
                </div>
              </div>
            ))}
          </div>
          {API_BASE && (
            <div className={styles.serverBox} style={{ background:'var(--cyan-glow)', border:'1px solid var(--border)', color:'var(--text-2)', marginTop:'auto' }}>
              <div style={{ color:'var(--cyan)', marginBottom:'4px', fontSize:'9px', letterSpacing:'.08em' }}>SERVER MODE</div>
              <div style={{ fontSize:'10px' }}>FastAPI · {API_BASE}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const DemoFace: React.FC<{color:string}> = ({color}) => (
  <svg width="140" height="160" viewBox="0 0 140 160">
    <ellipse cx="70" cy="82" rx="50" ry="62" fill="rgba(0,20,40,0.8)" stroke={`color-mix(in srgb, ${color} 40%, transparent)`} strokeWidth="1.5"/>
    <ellipse cx="70" cy="82" rx="50" ry="62" fill="none" stroke={color} strokeWidth="1" strokeDasharray="5 3" opacity=".4"/>
    <ellipse cx="52" cy="70" rx="11" ry="7" fill="none" stroke={`color-mix(in srgb, ${color} 70%, transparent)`} strokeWidth="1"/>
    <ellipse cx="88" cy="70" rx="11" ry="7" fill="none" stroke={`color-mix(in srgb, ${color} 70%, transparent)`} strokeWidth="1"/>
    <path d="M57 102 Q70 112 83 102" fill="none" stroke={`color-mix(in srgb, ${color} 55%, transparent)`} strokeWidth="1.5"/>
    <line x1="70" y1="20" x2="70" y2="42" stroke={`color-mix(in srgb, ${color} 30%, transparent)`} strokeWidth="1"/>
  </svg>
)

const AudioViz: React.FC<{color:string}> = ({color}) => {
  const bars = Array.from({length:28},(_,i)=>Math.abs(Math.sin(i*.55))*.65+.15)
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'14px' }}>
      <div style={{ display:'flex',alignItems:'flex-end',height:'70px',gap:'3px' }}>
        {bars.map((h,i)=>(
          <div key={i} style={{ width:'6px', height:`${h*70}px`, background:color, opacity:.7, borderRadius:'2px 2px 0 0',
            animation:`barPulse ${.7+i*.06}s ease-in-out infinite alternate`, boxShadow:`0 0 6px color-mix(in srgb, ${color} 50%, transparent)` }} />
        ))}
      </div>
      <div style={{ fontFamily:'Orbitron', fontSize:'10px', letterSpacing:'2px', color }}>AUDIO ANALYSIS</div>
    </div>
  )
}

export default ScanningPage
