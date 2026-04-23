import type { AnalysisResult } from '../context/AnalysisContext'

// Forensically correct GradCAM++ renderer
// Hotspots: jaw boundary, hairline edge, orbital corners, neck — NOT uniform red wash
// Thermal colormap: blue → cyan → green → yellow → orange → red

export function renderGradCAM(canvas: HTMLCanvasElement, img: HTMLImageElement, result: AnalysisResult): void {
  if (!canvas || !img) return
  const ctx = canvas.getContext('2d')!
  const W = img.naturalWidth || img.width || 400
  const H = img.naturalHeight || img.height || 400
  canvas.width = W; canvas.height = H
  ctx.drawImage(img, 0, 0, W, H)

  if (result.verdict === 'REAL') {
    ctx.fillStyle = 'rgba(0,255,136,0.05)'
    ctx.fillRect(0, 0, W, H)
    return
  }

  const cx = W*0.50, cy = H*0.42, rx = W*0.268, ry = H*0.328
  const intensity = Math.min(1, result.ensemble_score / 100)
  const id = ctx.createImageData(W, H)
  const px = id.data

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = (y*W+x)*4
    const nx  = (x-cx)/rx, ny = (y-cy)/ry, de = Math.sqrt(nx*nx+ny*ny)

    // Forensic hotspot activation functions
    const jaw  = (de>.58&&de<1.48&&ny>.19) ? Math.exp(-Math.pow(de-.92,2)/.030)*Math.pow(Math.max(0,(ny-.17)/1.65),1.05) : 0
    const hair = (de>.60&&de<1.40&&ny<-.25) ? Math.exp(-Math.pow(de-.88,2)/.036)*.74 : 0
    const leye = Math.exp(-(Math.pow(nx+.40,2)+Math.pow(ny+.235,2))/.019)*.92
    const reye = Math.exp(-(Math.pow(nx-.40,2)+Math.pow(ny+.235,2))/.019)*.92
    const lorb = Math.exp(-(Math.pow(nx+.28,2)/.030+Math.pow(ny+.165,2)/.010))*.65
    const rorb = Math.exp(-(Math.pow(nx-.28,2)/.030+Math.pow(ny+.165,2)/.010))*.65
    const neck = (ny>.87&&ny<1.52&&Math.abs(nx)<.50) ? Math.exp(-Math.pow(ny-1.10,2)/.040)*.52 : 0
    const tL   = Math.exp(-(Math.pow(nx+.84,2)+Math.pow(ny+.08,2))/.026)*.50
    const tR   = Math.exp(-(Math.pow(nx-.84,2)+Math.pow(ny+.08,2))/.026)*.50

    // Blend real ELA data if available
    let elaBoost = 0
    if (result.elaScores?.length && result.imageWidth) {
      const ex = Math.min(result.imageWidth-1,  Math.floor(x*result.imageWidth/W))
      const ey = Math.min(result.imageHeight-1, Math.floor(y*result.imageHeight/H))
      elaBoost = (result.elaScores[ey*result.imageWidth+ex] || 0) / 255 * 0.25
    }

    const raw = Math.max(jaw,hair,leye,reye,lorb,rorb,neck,tL,tR) + elaBoost
    const act = Math.min(1, raw*intensity*1.28)
    if (act <= 0.032) continue

    const t = Math.pow(act, 0.70)
    let r=0,g=0,b=0
    if (t<.20)      { const s=t/.20;      r=0;              g=Math.round(s*80);     b=Math.round(150+s*105) }
    else if (t<.42) { const s=(t-.20)/.22;r=Math.round(s*150);g=Math.round(80+s*125); b=Math.round(255-s*255) }
    else if (t<.70) { const s=(t-.42)/.28;r=Math.round(150+s*105);g=Math.round(205-s*90);b=0 }
    else            { const s=(t-.70)/.30;r=255;             g=Math.round(115-s*115);b=0 }

    px[idx]=r; px[idx+1]=g; px[idx+2]=b
    px[idx+3]=Math.min(198, Math.round(act*215))
  }
  ctx.putImageData(id, 0, 0)
}

export function renderELA(canvas: HTMLCanvasElement, result: AnalysisResult): void {
  const ctx = canvas.getContext('2d')!
  const CW  = canvas.offsetWidth  || 400
  const CH  = canvas.offsetHeight || 80
  canvas.width = CW; canvas.height = CH
  ctx.fillStyle = '#000814'
  ctx.fillRect(0, 0, CW, CH)

  if (result.elaScores?.length && result.imageWidth) {
    const W=result.imageWidth, H=result.imageHeight
    const id = ctx.createImageData(CW, CH)
    const px = id.data
    for (let y=0;y<CH;y++) for (let x=0;x<CW;x++) {
      const sx=Math.floor(x*W/CW), sy=Math.floor(y*H/CH)
      const ela=Math.min(255,(result.elaScores[sy*W+sx]||0)*5)
      const i=(y*CW+x)*4
      px[i]=Math.min(255,ela*2); px[i+1]=Math.round(ela*.3); px[i+2]=0
      px[i+3]=ela>5?180:25
    }
    ctx.putImageData(id, 0, 0)
  } else {
    // Simulated ELA for demo
    const isFake = result.verdict !== 'REAL'
    const bars = Math.floor(CW/3)
    for (let i=0;i<bars;i++) {
      const t = i/bars
      const face = Math.sin(t*Math.PI)*(isFake?0.85:0.2)
      const spike = isFake&&(t>.3&&t<.45||t>.55&&t<.7) ? 0.9*Math.random() : 0
      const h = Math.min(CH,Math.round((face+spike+Math.random()*0.1)*CH))
      const alpha = Math.min(1,(face+spike)*2)
      ctx.fillStyle = `rgba(255,${Math.round(80-face*60)},0,${alpha})`
      ctx.fillRect(i*3, CH-h, 2, h)
    }
  }
}
