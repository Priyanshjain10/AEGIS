import React, { createContext, useState, useContext, type ReactNode } from 'react'

export interface FileData {
  file: File | null
  name: string
  size: string
  type: string
  previewUrl: string
  modality: 'IMAGE' | 'VIDEO' | 'AUDIO'
}

export interface AnalysisResult {
  verdict: 'REAL' | 'INCONCLUSIVE' | 'LIKELY_SYNTHETIC' | 'HIGH_CONFIDENCE_SYNTHETIC'
  ensemble_score: number
  spatial_score: number
  temporal_score: number
  inference_ms: number
  findings: string[]
  hotspots: string[]
  summary: string
  avgELA: number
  avgEdge: number
  avgLocalVar: number
  elaScores: Float32Array
  imageWidth: number
  imageHeight: number
}

export interface BackendArtifacts {
  heatmap_png_base64: string
  ela_png_base64: string
  processing_ms: number
  request_id: string
  module_scores: Array<{ id: string; name: string; score: number; status: string; summary: string }>
  frequency_bins: number[]
  anomaly_codes: string[]
}

interface Ctx {
  fileData: FileData | null
  setFileData: (d: FileData | null) => void
  result: AnalysisResult | null
  setResult: (r: AnalysisResult | null) => void
  backendArtifacts: BackendArtifacts | null
  setBackendArtifacts: (a: BackendArtifacts | null) => void
}

const AnalysisContext = createContext<Ctx | undefined>(undefined)

export const AnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fileData, setFileData]                   = useState<FileData | null>(null)
  const [result, setResult]                       = useState<AnalysisResult | null>(null)
  const [backendArtifacts, setBackendArtifacts]   = useState<BackendArtifacts | null>(null)
  return (
    <AnalysisContext.Provider value={{ fileData, setFileData, result, setResult, backendArtifacts, setBackendArtifacts }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export const useAnalysis = () => {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysis must be inside AnalysisProvider')
  return ctx
}
