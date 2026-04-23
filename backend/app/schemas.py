from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

VerdictLabel = Literal[
    "REAL",
    "INCONCLUSIVE",
    "LIKELY_SYNTHETIC",
    "HIGH_CONFIDENCE_SYNTHETIC",
]
SeverityLabel = Literal["low", "medium", "high"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


class MediaInfo(BaseModel):
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    width: int
    height: int
    analyzed_width: int
    analyzed_height: int
    color_mode: str
    format: str = Field(default="UNKNOWN")


class VerdictInfo(BaseModel):
    label: VerdictLabel
    confidence: float
    risk_level: Literal["low", "moderate", "high", "critical"]
    explanation: str


class MetricsInfo(BaseModel):
    ela_score: float
    edge_score: float
    texture_uniformity_score: float
    frequency_anomaly_score: float
    color_consistency_score: float
    overall_suspicion_score: float


class ModuleScore(BaseModel):
    id: str
    name: str
    score: float
    status: Literal["clean", "review", "flagged"]
    summary: str


class AnomalyItem(BaseModel):
    code: str
    severity: SeverityLabel
    title: str
    description: str


class Hotspot(BaseModel):
    label: str
    x: float
    y: float
    intensity: float


class TimelinePoint(BaseModel):
    index: int
    time_ms: int
    confidence: float
    flagged: bool


class ArtifactBundle(BaseModel):
    heatmap_png_base64: str
    ela_png_base64: str


class ReportSummary(BaseModel):
    headline: str
    executive_summary: str
    recommendations: list[str]


class AnalysisResponse(BaseModel):
    request_id: str
    analyzed_at: str
    processing_ms: int
    engine_version: str
    media: MediaInfo
    verdict: VerdictInfo
    metrics: MetricsInfo
    module_scores: list[ModuleScore]
    anomalies: list[AnomalyItem]
    hotspots: list[Hotspot]
    timeline: list[TimelinePoint]
    frequency_bins: list[float]
    artifacts: ArtifactBundle
    report: ReportSummary
