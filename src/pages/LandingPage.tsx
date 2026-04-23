import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

const BASE = import.meta.env.BASE_URL

const LandingPage: React.FC = () => {
  const [frameIndex, setFrameIndex] = useState(1)
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex(prev => {
        if (prev >= 40) {
          clearInterval(interval)
          if (!done.current) {
            done.current = true
            setTimeout(() => navigate('/upload'), 800)
          }
          return prev
        }
        return prev + 1
      })
    }, 1000 / 24)
    return () => clearInterval(interval)
  }, [navigate])

  const frameNum  = frameIndex.toString().padStart(3, '0')
  const frameSrc  = `${BASE}frames/ezgif-frame-${frameNum}.png`

  return (
    <div className={`fade-in ${styles.container}`}>
      <div className={styles.videoContainer}>
        <img
          src={frameSrc}
          alt="AEGIS intro"
          className={styles.animationFrame}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
        <div className={styles.overlay} />
      </div>
      <div className={styles.titleContainer}>
        <h1 className={`glow-text-cyan pulse-animation ${styles.title}`}>AEGIS</h1>
        <p className={styles.subtitle}>Open-Source Deepfake Detection</p>
        <p className={styles.tagline}>Multi-modal · Explainable · Real-time · Free forever</p>
      </div>
    </div>
  )
}

export default LandingPage
