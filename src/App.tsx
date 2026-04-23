import React from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import HexGrid from './components/HexGrid'
import LandingPage from './pages/LandingPage'
import UploadPage from './pages/UploadPage'
import ScanningPage from './pages/ScanningPage'
import VerdictPage from './pages/VerdictPage'
import HeatmapPage from './pages/HeatmapPage'
import ForensicPage from './pages/ForensicPage'
import PricingPage from './pages/PricingPage'
import { AnalysisProvider } from './context/AnalysisContext'

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loc = useLocation()
  const showNav = loc.pathname !== '/'
  return (
    <>
      <HexGrid />
      <div className="scanline" />
      {showNav && <Navbar />}
      {children}
    </>
  )
}

const App: React.FC = () => (
  <AnalysisProvider>
    <Router>
      <AppShell>
        <Routes>
          <Route path="/"         element={<LandingPage />} />
          <Route path="/upload"   element={<UploadPage />} />
          <Route path="/scanning" element={<ScanningPage />} />
          <Route path="/verdict"  element={<VerdictPage />} />
          <Route path="/heatmap"  element={<HeatmapPage />} />
          <Route path="/forensic" element={<ForensicPage />} />
          <Route path="/pricing"  element={<PricingPage />} />
        </Routes>
      </AppShell>
    </Router>
  </AnalysisProvider>
)

export default App
