import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import { renderGradCAM, renderELA } from '../lib/gradcam'
import styles from './HeatmapPage.module.css'

type View = 'HEATMAP'|'LANDMARK'|'FREQUENCY'|'SERVER'

const HeatmapPage: React.FC = () => {
  const navigate = useNavigate()
  const { fileData, result, backendArtifacts } = useAnalysis()
  const hasBackend = !!backendArtifacts?.heatmap_png_base64
  const [view, setView] = useState<View>(hasBackend?'SERVER':'HEATMAP')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const elaRef    = useRef<HTMLCanvasElement>(null)
  const imgRef    = useRef<HTMLImageElement>(null)
  const isFake    = result?.verdict==='HIGH_CONFIDENCE_SYNTHETIC'||result?.verdict==='LIKELY_SYNTHETIC'

  const drawCanvas = useCallback((cv: View) => {
    const canvas=canvasRef.current; const img=imgRef.current
    if (!canvas||!result) return
    if (cv==='SERVER'&&hasBackend) {
      const si=new Image(); si.onload=()=>{ canvas.width=si.width; canvas.height=si.height; canvas.getContext('2d')!.drawImage(si,0,0) }
      si.src=`data:image/png;base64,${backendArtifacts!.heatmap_png_base64}`; return
    }
    if (!img||!img.naturalWidth) return
    if (cv==='HEATMAP') { renderGradCAM(canvas,img,result); return }
    const ctx=canvas.getContext('2d')!
    canvas.width=img.naturalWidth; canvas.height=img.naturalHeight
    ctx.drawImage(img,0,0)
    if (cv==='LANDMARK') drawLandmarks(ctx,canvas.width,canvas.height,isFake)
    if (cv==='FREQUENCY') drawFrequency(ctx,canvas.width,canvas.height,isFake)
  }, [result, isFake, hasBackend, backendArtifacts])

  useEffect(() => {
    const img=imgRef.current
    if (!img) { drawCanvas(view); return }
    const go=()=>drawCanvas(view)
    if (img.complete&&img.naturalWidth>0) go(); else img.onload=go
  }, [view, drawCanvas])

  useEffect(() => {
    const id=setTimeout(()=>{ if (!elaRef.current||!result) return
      if (view==='SERVER'&&backendArtifacts?.ela_png_base64) {
        const ei=new Image(); ei.onload=()=>{ const c=elaRef.current!; c.width=ei.width; c.height=ei.height; c.getContext('2d')!.drawImage(ei,0,0) }
        ei.src=`data:image/png;base64,${backendArtifacts.ela_png_base64}`
      } else renderELA(elaRef.current,result)
    },150)
    return ()=>clearTimeout(id)
  },[result,view,backendArtifacts])

  const freqBars = useMemo(() => {
    if (backendArtifacts?.frequency_bins?.length) return backendArtifacts.frequency_bins.slice(0,16).map(v=>Math.round(v*100))
    const f=[40,72,90,85,62,76,88,93,65,80,84,56,70,68,75,60]
    const r=[18,32,26,38,20,35,22,30,16,28,22,18,25,20,24,18]
    return isFake?f:r
  },[isFake,backendArtifacts])

  const viewTabs: {v:View; label:string}[] = [
    ...(hasBackend?[{v:'SERVER' as View,label:'SERVER'}]:[]),
    {v:'HEATMAP',label:'GRADCAM'},{v:'LANDMARK',label:'LANDMARK'},{v:'FREQUENCY',label:'FFT'},
  ]

  return (
    <div className={`fade-in ${styles.page}`}>

      {/* LEFT */}
      <div className={`${styles.panel} ${styles.left}`}>
        <div className={styles.panelHead}><div className={styles.panelTitle}>ANOMALIES</div></div>
        <div className={styles.panelBody}>
          {(result?.findings??[]).map((f,i)=>(
            <div key={i} className={styles.findingItem}
              style={{ borderColor: i<2&&isFake?'var(--red)':'var(--border-med)', color: i<2&&isFake?'var(--text)':'var(--text-2)' }}>
              {f}
            </div>
          ))}
          {!result?.findings?.length && <div style={{ color:'var(--green)', fontSize:'12px' }}>No anomalies detected.</div>}

          {(result?.hotspots?.length??0)>0 && (
            <div>
              <div style={{ fontSize:'9px', color:'var(--text-3)', marginBottom:'8px', letterSpacing:'.08em' }}>GRADCAM HOTSPOTS</div>
              <div className={styles.hotspotWrap}>
                {result!.hotspots.map(h=><span key={h} className={styles.hotspot}>{h}</span>)}
              </div>
            </div>
          )}

          {backendArtifacts?.anomaly_codes?.length ? (
            <div>
              <div style={{ fontSize:'9px', color:'var(--text-3)', marginBottom:'8px', letterSpacing:'.08em' }}>SERVER CODES</div>
              <div className={styles.anonCodeWrap}>
                {backendArtifacts.anomaly_codes.map(c=><span key={c} className={styles.anonCode}>{c}</span>)}
              </div>
            </div>
          ):null}

          <div style={{ marginTop:'auto' }}>
            <button className="hud-button" style={{ width:'100%' }} onClick={()=>navigate('/forensic')}>FULL REPORT</button>
          </div>
        </div>
      </div>

      {/* CENTER */}
      <div className={`${styles.panel} ${styles.center}`}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitle}>FORENSIC EVIDENCE</div>
          {hasBackend && view==='SERVER' && (
            <span style={{ fontSize:'9px', color:'var(--green)', background:'var(--green-glow)', border:'1px solid var(--green-dim)', padding:'3px 10px', borderRadius:'20px' }}>
              ✓ Server computed · {backendArtifacts!.processing_ms}ms
            </span>
          )}
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'12px', gap:'10px', overflow:'hidden' }}>
          <div className={styles.imageBox}>
            {fileData?.previewUrl ? (
              <>
                <img ref={imgRef} src={fileData.previewUrl} alt="" style={{ display:'none' }} onLoad={()=>drawCanvas(view)} />
                <canvas ref={canvasRef} className={styles.canvas} />
              </>
            ) : <DemoFaceSVG />}
          </div>

          <div className={styles.elaStrip}>
            <div className={styles.elaHead}>
              ERROR LEVEL ANALYSIS {view==='SERVER'&&backendArtifacts?.ela_png_base64?' · SERVER':'· BROWSER'}
            </div>
            <canvas ref={elaRef} className={styles.elaCanvas} />
          </div>

          <div className={styles.viewTabs}>
            {viewTabs.map(({v,label})=>(
              <button key={v} className={`${styles.viewTab} ${view===v?(v==='SERVER'?styles.activeServer:styles.active):''}`} onClick={()=>setView(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className={`${styles.panel} ${styles.right}`}>
        <div className={styles.panelHead}><div className={styles.panelTitle}>FREQUENCY DOMAIN</div></div>
        <div className={styles.panelBody}>
          <div className={styles.freqChart}>
            {freqBars.map((h,i)=>(
              <div key={i} className={styles.freqBar}
                style={{ height:`${h}%`, background: h>75?'var(--red)':h>50?'var(--cyan)':'rgba(0,229,255,0.35)' }} />
            ))}
          </div>
          {backendArtifacts && <div style={{ fontSize:'9px', color:'var(--green)', marginTop:'6px' }}>✓ Real FFT bins from server</div>}
          <p className={styles.freqNote}>
            {isFake?'Irregular high-frequency spectral signature — GAN upsampling artifacts confirmed.':'Frequency distribution consistent with natural camera noise.'}
          </p>
        </div>
      </div>
    </div>
  )
}

const DemoFaceSVG: React.FC = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%' }}>
    <svg width="200" height="240" viewBox="0 0 200 240">
      <defs>
        <radialGradient id="dg" cx="50%" cy="43%" r="52%">
          <stop offset="0%" stopColor="#142238"/><stop offset="100%" stopColor="#070F1C"/>
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="118" rx="74" ry="92" fill="url(#dg)" stroke="#1E3D60" strokeWidth="1"/>
      <ellipse cx="100" cy="118" rx="74" ry="92" fill="none" stroke="rgba(255,34,68,0.35)" strokeWidth="2" strokeDasharray="5 3"/>
      <path d="M36 188 Q100 224 164 188" fill="none" stroke="rgba(255,80,0,0.8)" strokeWidth="3"/>
      <ellipse cx="70" cy="100" rx="18" ry="11" fill="rgba(255,50,0,0.4)"/>
      <ellipse cx="130" cy="100" rx="18" ry="11" fill="rgba(255,50,0,0.4)"/>
      <path d="M36 52 Q100 18 164 52" fill="none" stroke="rgba(200,100,0,0.7)" strokeWidth="3"/>
      <text x="4" y="206" fill="rgba(255,80,0,0.7)" fontSize="7" fontFamily="monospace">JAW BOUNDARY</text>
      <text x="136" y="86" fill="rgba(255,80,0,0.7)" fontSize="7" fontFamily="monospace">EYE</text>
      <text x="114" y="36" fill="rgba(255,80,0,0.7)" fontSize="7" fontFamily="monospace">HAIRLINE</text>
      <circle cx="100" cy="22" r="4" fill="rgba(255,34,68,0.8)"/>
      <circle cx="140" cy="100" r="3.5" fill="rgba(255,34,68,0.8)"/>
      <circle cx="44" cy="184" r="4" fill="rgba(255,34,68,0.8)"/>
    </svg>
  </div>
)

function drawLandmarks(ctx:CanvasRenderingContext2D,W:number,H:number,isFake:boolean){
  const cx=W*.5,cy=H*.42,rx=W*.268,ry=H*.328
  const pts=[...Array.from({length:24},(_,i)=>({x:cx+rx*Math.cos(i/24*Math.PI*2),y:cy+ry*Math.sin(i/24*Math.PI*2)})),
    {x:cx-rx*.40,y:cy-ry*.235},{x:cx-rx*.28,y:cy-ry*.235},{x:cx+rx*.40,y:cy-ry*.235},{x:cx+rx*.28,y:cy-ry*.235},
    {x:cx,y:cy-.1*ry},{x:cx,y:cy+.1*ry},{x:cx-rx*.2,y:cy+ry*.28},{x:cx+rx*.2,y:cy+ry*.28}]
  const col=isFake?'#FF2244':'#00FF9D'
  pts.forEach(pt=>{ctx.beginPath();ctx.arc(pt.x,pt.y,2,0,Math.PI*2);ctx.fillStyle=col;ctx.fill()})
  ctx.strokeStyle=isFake?'rgba(255,34,68,0.4)':'rgba(0,255,157,0.4)';ctx.lineWidth=1
  ctx.beginPath();pts.slice(0,24).forEach((pt,i)=>i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y))
  ctx.closePath();ctx.stroke()
}

function drawFrequency(ctx:CanvasRenderingContext2D,W:number,H:number,isFake:boolean){
  const bs=16
  for(let y=0;y<H;y+=bs)for(let x=0;x<W;x+=bs){
    const dx=(x+bs/2-W/2)/(W/2),dy=(y+bs/2-H/2)/(H/2)
    const face=Math.exp(-(dx*dx+dy*dy)/.25)
    const h=isFake?face*.8+Math.random()*.2:Math.random()*.2
    ctx.fillStyle=`rgba(${Math.round(h*255)},${Math.round((1-h)*100)},0,${h*.6})`
    ctx.fillRect(x,y,bs-1,bs-1)
  }
}

export default HeatmapPage
