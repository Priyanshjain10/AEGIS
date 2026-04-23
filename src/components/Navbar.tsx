import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './Navbar.module.css'

const PAGE_NAMES: Record<string, string> = {
  '/':        'SYS.INIT',
  '/upload':  'MEDIA INGEST',
  '/scanning':'ACTIVE SCAN',
  '/verdict': 'VERDICT',
  '/heatmap': 'EVIDENCE HEATMAP',
  '/forensic':'FORENSIC REPORT',
  '/pricing': 'PRICING & BRK',
}

const Navbar: React.FC = () => {
  const [time, setTime] = useState(new Date().toLocaleTimeString())
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(t)
  }, [])

  const pageName = PAGE_NAMES[location.pathname] ?? 'SYSTEM'

  return (
    <nav className={styles.navbar}>
      {/* Left: Logo */}
      <div className={styles.logoContainer} onClick={() => navigate('/upload')} role="button" tabIndex={0}>
        <div className={styles.logoMark} />
        <span className={styles.logoText}>AEGIS</span>
      </div>

      {/* Center: Page indicator */}
      <div className={styles.pageIndicator}>{pageName}</div>

      {/* Right: status + pricing + time */}
      <div className={styles.navRight}>
        <div className={styles.statusDot} title="System online" />
        <button
          className={`${styles.pricingBtn} ${location.pathname === '/pricing' ? styles.active : ''}`}
          onClick={() => navigate('/pricing')}
        >
          BRK PRICING
        </button>
        <div className={styles.timeContainer}>{time}</div>
      </div>
    </nav>
  )
}

export default Navbar
