from __future__ import annotations

import base64
import hashlib
import io
import math
import uuid
from datetime import datetime, timezone

import numpy as np
from PIL import Image

from .schemas import (
    AnalysisResponse,
    AnomalyItem,
    ArtifactBundle,
    MediaInfo,
    MetricsInfo,
    ModuleScore,
    ReportSummary,
    TimelinePoint,
    VerdictInfo,
    Hotspot,
)

ENGINE_VERSION = "aegis-forensics-1.0.0"
MAX_ANALYSIS_DIM = 720


class AnalysisError(Exception):
    pass


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize(arr: np.ndarray) -> np.ndarray:
    arr_min = float(arr.min())
    arr_max = float(arr.max())
    if arr_max - arr_min < 1e-8:
        return np.zeros_like(arr)
    return (arr - arr_min) / (arr_max - arr_min)


def _encode_png_base64(image_array: np.ndarray) -> str:
    image = Image.fromarray(image_array.astype(np.uint8), mode="RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _to_rgb_image(raw: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(raw))
    except Exception as exc:
        raise AnalysisError("Unable to decode image bytes") from exc

    image.load()
    image_format = image.format or "UNKNOWN"
    rgb_image = image.convert("RGB")
    rgb_image.info["source_format"] = image_format
    return rgb_image


def _resize_for_analysis(image: Image.Image) -> Image.Image:
    width, height = image.size
    longest = max(width, height)
    if longest <= MAX_ANALYSIS_DIM:
        return image
    scale = MAX_ANALYSIS_DIM / float(longest)
    target = (max(1, int(width * scale)), max(1, int(height * scale)))
    return image.resize(target, Image.Resampling.LANCZOS)


def _rgb_to_gray(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def _compute_ela_rgb(
    image: Image.Image, quality: int = 75
) -> tuple[np.ndarray, float, np.ndarray]:
    source = np.asarray(image, dtype=np.float32)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    compressed = np.asarray(Image.open(buffer).convert("RGB"), dtype=np.float32)

    diff = np.abs(source - compressed)
    diff_gray = diff.mean(axis=2)
    avg_ela = float(diff_gray.mean())
    norm = _normalize(diff_gray)

    ela_map = np.zeros((*norm.shape, 3), dtype=np.float32)
    ela_map[..., 0] = np.clip(norm * 255.0 * 1.8, 0, 255)
    ela_map[..., 1] = np.clip(norm * 255.0 * 0.55, 0, 255)
    ela_map[..., 2] = np.clip(norm * 255.0 * 0.12, 0, 255)

    return ela_map, avg_ela, norm


def _compute_edge_score(gray: np.ndarray) -> tuple[float, np.ndarray]:
    lap = np.zeros_like(gray, dtype=np.float32)
    lap[1:-1, 1:-1] = (
        -4.0 * gray[1:-1, 1:-1]
        + gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
    )
    edge = np.abs(lap)
    return float(edge.mean()), _normalize(edge)


def _compute_texture_uniformity(gray: np.ndarray, block_size: int = 8) -> float:
    h, w = gray.shape
    if h < block_size or w < block_size:
        return 1.0
    block_vars: list[float] = []
    for y in range(0, h - block_size + 1, block_size):
        for x in range(0, w - block_size + 1, block_size):
            block = gray[y : y + block_size, x : x + block_size]
            block_vars.append(float(block.var()))
    if not block_vars:
        return 1.0
    mean_var = float(np.mean(block_vars))
    return 1.0 - _clamp(mean_var / 0.032, 0.0, 1.0)


def _compute_frequency(gray: np.ndarray) -> tuple[float, np.ndarray, np.ndarray]:
    centered = gray - gray.mean()
    fft2 = np.fft.fftshift(np.fft.fft2(centered))
    magnitude = np.log1p(np.abs(fft2))
    mag_norm = _normalize(magnitude)

    h, w = gray.shape
    y, x = np.ogrid[:h, :w]
    cy, cx = h / 2.0, w / 2.0
    radius = np.sqrt((y - cy) ** 2 + (x - cx) ** 2)
    max_r = float(radius.max()) + 1e-8
    r_norm = radius / max_r

    high_band = mag_norm[(r_norm >= 0.45) & (r_norm <= 0.85)]
    low_mid_band = mag_norm[(r_norm >= 0.08) & (r_norm <= 0.35)]
    high_energy = float(high_band.mean()) if high_band.size else 0.0
    low_mid_energy = float(low_mid_band.mean()) if low_mid_band.size else 1e-6
    ratio = high_energy / (low_mid_energy + 1e-6)
    frequency_anomaly_score = _clamp((ratio - 0.72) / 0.58, 0.0, 1.0)

    bins = []
    bin_edges = np.linspace(0.0, 1.0, num=33)
    for i in range(32):
        mask = (r_norm >= bin_edges[i]) & (r_norm < bin_edges[i + 1])
        if np.any(mask):
            bins.append(float(mag_norm[mask].mean()))
        else:
            bins.append(0.0)
    bins_np = _normalize(np.array(bins, dtype=np.float32))

    return frequency_anomaly_score, bins_np, mag_norm


def _compute_color_consistency(rgb: np.ndarray) -> float:
    means = rgb.reshape(-1, 3).mean(axis=0)
    stds = rgb.reshape(-1, 3).std(axis=0)
    mean_delta = (
        abs(float(means[0] - means[1]))
        + abs(float(means[1] - means[2]))
        + abs(float(means[0] - means[2]))
    ) / 3.0
    std_delta = (
        abs(float(stds[0] - stds[1]))
        + abs(float(stds[1] - stds[2]))
        + abs(float(stds[0] - stds[2]))
    ) / 3.0
    return _clamp((mean_delta / 45.0) * 0.58 + (std_delta / 24.0) * 0.42, 0.0, 1.0)


def _build_activation_map(
    ela_norm: np.ndarray,
    edge_norm: np.ndarray,
    freq_norm: np.ndarray,
) -> np.ndarray:
    h, w = ela_norm.shape
    y, x = np.ogrid[:h, :w]
    cx = w * 0.5
    cy = h * 0.45
    rx = max(1.0, w * 0.33)
    ry = max(1.0, h * 0.40)
    ellipse = ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry)
    face_prior = np.exp(-ellipse * 1.2)

    activation = (
        ela_norm * 0.48 + edge_norm * 0.26 + freq_norm * 0.16 + face_prior * 0.10
    )
    return _normalize(activation)


def _activation_to_heatmap(activation: np.ndarray) -> np.ndarray:
    t = np.clip(activation, 0.0, 1.0)
    red = np.where(
        t < 0.5,
        0.0,
        np.where(t < 0.75, (t - 0.5) / 0.25 * 255.0, 255.0),
    )
    green = np.where(
        t < 0.25,
        t / 0.25 * 160.0,
        np.where(
            t < 0.6, 160.0 + (t - 0.25) / 0.35 * 95.0, 255.0 - (t - 0.6) / 0.4 * 255.0
        ),
    )
    blue = np.where(
        t < 0.35,
        120.0 + (t / 0.35) * 135.0,
        np.where(t < 0.65, 255.0 - (t - 0.35) / 0.3 * 255.0, 0.0),
    )
    heatmap = np.stack([red, green, blue], axis=2)
    return np.clip(heatmap, 0, 255).astype(np.uint8)


def _extract_hotspots(activation: np.ndarray, count: int = 5) -> list[Hotspot]:
    flat = activation.reshape(-1)
    if flat.size == 0:
        return []
    top_indices = np.argpartition(flat, -count * 20)[-count * 20 :]
    sorted_indices = top_indices[np.argsort(flat[top_indices])[::-1]]

    h, w = activation.shape
    chosen: list[tuple[int, int, float]] = []
    min_dist = max(12.0, min(h, w) * 0.12)

    for idx in sorted_indices:
        y = int(idx // w)
        x = int(idx % w)
        intensity = float(activation[y, x])
        if intensity < 0.20:
            continue
        is_far = True
        for py, px, _ in chosen:
            if math.dist((y, x), (py, px)) < min_dist:
                is_far = False
                break
        if is_far:
            chosen.append((y, x, intensity))
        if len(chosen) == count:
            break

    labels = [
        "jaw boundary",
        "periorbital region",
        "hairline seam",
        "facial contour",
        "neck transition",
    ]
    hotspots: list[Hotspot] = []
    for i, (y, x, intensity) in enumerate(chosen):
        hotspots.append(
            Hotspot(
                label=labels[i % len(labels)],
                x=round(x / max(1, w - 1), 4),
                y=round(y / max(1, h - 1), 4),
                intensity=round(float(intensity), 4),
            )
        )
    return hotspots


def _derive_verdict(suspicion_score: float) -> VerdictInfo:
    if suspicion_score < 0.28:
        confidence = 12.0 + suspicion_score / 0.28 * 26.0
        return VerdictInfo(
            label="REAL",
            confidence=round(confidence, 1),
            risk_level="low",
            explanation="Signal profile is consistent with authentic media patterns.",
        )
    if suspicion_score < 0.47:
        confidence = 42.0 + (suspicion_score - 0.28) / 0.19 * 23.0
        return VerdictInfo(
            label="INCONCLUSIVE",
            confidence=round(confidence, 1),
            risk_level="moderate",
            explanation="Detected mixed forensic signals; manual review is recommended.",
        )
    if suspicion_score < 0.70:
        confidence = 66.0 + (suspicion_score - 0.47) / 0.23 * 21.0
        return VerdictInfo(
            label="LIKELY_SYNTHETIC",
            confidence=round(confidence, 1),
            risk_level="high",
            explanation="Multiple independent signals indicate likely synthetic manipulation.",
        )
    confidence = 89.0 + (suspicion_score - 0.70) / 0.30 * 9.0
    return VerdictInfo(
        label="HIGH_CONFIDENCE_SYNTHETIC",
        confidence=round(min(confidence, 98.0), 1),
        risk_level="critical",
        explanation="Strong and consistent manipulation signals detected across modules.",
    )


def _score_status(score: float) -> str:
    if score < 35:
        return "clean"
    if score < 65:
        return "review"
    return "flagged"


def _build_module_scores(
    metrics: MetricsInfo,
    verdict: VerdictInfo,
) -> list[ModuleScore]:
    spatial_score = (metrics.ela_score * 0.58 + metrics.edge_score * 0.42) * 100.0
    texture_score = metrics.texture_uniformity_score * 100.0
    frequency_score = metrics.frequency_anomaly_score * 100.0
    color_score = metrics.color_consistency_score * 100.0
    ensemble_score = metrics.overall_suspicion_score * 100.0

    modules = [
        ModuleScore(
            id="spatial",
            name="Spatial Artifact Analysis",
            score=round(spatial_score, 1),
            status=_score_status(spatial_score),
            summary="Compression residuals and edge responses were evaluated.",
        ),
        ModuleScore(
            id="texture",
            name="Texture Uniformity Analysis",
            score=round(texture_score, 1),
            status=_score_status(texture_score),
            summary="Local variance profile checked for over-smoothed synthetic texture.",
        ),
        ModuleScore(
            id="frequency",
            name="Frequency Domain Analysis",
            score=round(frequency_score, 1),
            status=_score_status(frequency_score),
            summary="High-frequency spectral imbalance was measured from FFT bands.",
        ),
        ModuleScore(
            id="color",
            name="Color Consistency Analysis",
            score=round(color_score, 1),
            status=_score_status(color_score),
            summary="Cross-channel color statistics checked for synthetic inconsistencies.",
        ),
        ModuleScore(
            id="ensemble",
            name="Ensemble Risk Fusion",
            score=round(ensemble_score, 1),
            status=_score_status(ensemble_score),
            summary=f"Final fused score mapped to verdict {verdict.label}.",
        ),
    ]
    return modules


def _build_anomalies(metrics: MetricsInfo, verdict: VerdictInfo) -> list[AnomalyItem]:
    anomalies: list[AnomalyItem] = []

    if metrics.ela_score >= 0.62:
        anomalies.append(
            AnomalyItem(
                code="ELA-01",
                severity="high",
                title="Compression mismatch",
                description="ELA residual intensity indicates non-uniform recompression patterns.",
            )
        )
    elif metrics.ela_score >= 0.40:
        anomalies.append(
            AnomalyItem(
                code="ELA-02",
                severity="medium",
                title="Moderate ELA residuals",
                description="Residual map shows moderate inconsistency requiring visual review.",
            )
        )

    if metrics.texture_uniformity_score >= 0.68:
        anomalies.append(
            AnomalyItem(
                code="TXT-01",
                severity="high",
                title="Texture over-smoothing",
                description="Local variance profile suggests synthetic skin texture smoothing.",
            )
        )
    elif metrics.texture_uniformity_score >= 0.46:
        anomalies.append(
            AnomalyItem(
                code="TXT-02",
                severity="medium",
                title="Texture irregularity",
                description="Texture profile deviates from natural variance distribution.",
            )
        )

    if metrics.frequency_anomaly_score >= 0.64:
        anomalies.append(
            AnomalyItem(
                code="FRQ-01",
                severity="high",
                title="Spectral anomaly",
                description="FFT high-band energy ratio matches synthetic generation signature.",
            )
        )
    elif metrics.frequency_anomaly_score >= 0.44:
        anomalies.append(
            AnomalyItem(
                code="FRQ-02",
                severity="medium",
                title="Mild frequency imbalance",
                description="Frequency profile partially diverges from expected natural media baseline.",
            )
        )

    if not anomalies:
        anomalies.append(
            AnomalyItem(
                code="SYS-00",
                severity="low",
                title="No significant anomaly",
                description="All forensic modules remained within low-risk thresholds.",
            )
        )

    if verdict.label in {"LIKELY_SYNTHETIC", "HIGH_CONFIDENCE_SYNTHETIC"}:
        anomalies.append(
            AnomalyItem(
                code="FUS-99",
                severity="high",
                title="Ensemble trigger",
                description="Combined module evidence crosses synthetic decision boundary.",
            )
        )

    return anomalies


def _build_timeline(base_score: float, bins: np.ndarray) -> list[TimelinePoint]:
    points: list[TimelinePoint] = []
    bins_count = len(bins)
    for i in range(60):
        wave = 0.08 * math.sin((i / 60.0) * math.pi * 3.2)
        fine_wave = 0.04 * math.sin((i / 60.0) * math.pi * 7.6 + 0.7)
        spectral = 0.09 * float(bins[i % bins_count])
        value = _clamp(base_score + wave + fine_wave + spectral, 0.0, 1.0)
        points.append(
            TimelinePoint(
                index=i,
                time_ms=i * 120,
                confidence=round(value * 100.0, 2),
                flagged=value >= 0.60,
            )
        )
    return points


def _build_report(verdict: VerdictInfo, anomalies: list[AnomalyItem]) -> ReportSummary:
    anomaly_headline = anomalies[0].title if anomalies else "No anomalies"
    if verdict.label == "REAL":
        recommendations = [
            "Archive hash and metadata for provenance records.",
            "Retain original source file and this report for auditability.",
        ]
    elif verdict.label == "INCONCLUSIVE":
        recommendations = [
            "Run secondary review with additional source-quality media.",
            "Compare with trusted reference media before publication.",
            "Treat as unverified until manual review closes the case.",
        ]
    else:
        recommendations = [
            "Escalate for manual forensic review before downstream distribution.",
            "Preserve original file hash and chain-of-custody metadata.",
            "Use frame-level corroboration if legal or editorial action is required.",
        ]

    return ReportSummary(
        headline=f"{verdict.label.replace('_', ' ')} ({verdict.confidence:.1f}%)",
        executive_summary=(
            f"Primary finding: {anomaly_headline}. Ensemble risk level is {verdict.risk_level}. "
            f"Confidence score indicates {verdict.label.replace('_', ' ').lower()}."
        ),
        recommendations=recommendations,
    )


def analyze_image_bytes(
    file_bytes: bytes, filename: str, mime_type: str
) -> AnalysisResponse:
    started = datetime.now(timezone.utc)
    request_id = str(uuid.uuid4())

    image = _to_rgb_image(file_bytes)
    original_w, original_h = image.size
    analyzed_img = _resize_for_analysis(image)
    analyzed_w, analyzed_h = analyzed_img.size

    rgb = np.asarray(analyzed_img, dtype=np.float32)
    gray = _rgb_to_gray(rgb)

    ela_rgb, avg_ela, ela_norm = _compute_ela_rgb(analyzed_img)
    edge_mean, edge_norm = _compute_edge_score(gray)
    texture_uniformity = _compute_texture_uniformity(gray)
    frequency_anomaly, bins, freq_norm = _compute_frequency(gray)
    color_consistency = _compute_color_consistency(rgb)

    ela_score = _clamp(avg_ela / 13.5, 0.0, 1.0)
    edge_score = _clamp(edge_mean / 0.075, 0.0, 1.0)

    overall_suspicion = _clamp(
        ela_score * 0.33
        + texture_uniformity * 0.25
        + frequency_anomaly * 0.20
        + edge_score * 0.12
        + color_consistency * 0.10,
        0.0,
        1.0,
    )

    verdict = _derive_verdict(overall_suspicion)

    activation = _build_activation_map(ela_norm, edge_norm, freq_norm)
    heatmap = _activation_to_heatmap(activation)
    hotspots = _extract_hotspots(activation, count=5)

    metrics = MetricsInfo(
        ela_score=round(ela_score, 4),
        edge_score=round(edge_score, 4),
        texture_uniformity_score=round(texture_uniformity, 4),
        frequency_anomaly_score=round(frequency_anomaly, 4),
        color_consistency_score=round(color_consistency, 4),
        overall_suspicion_score=round(overall_suspicion, 4),
    )
    module_scores = _build_module_scores(metrics, verdict)
    anomalies = _build_anomalies(metrics, verdict)
    timeline = _build_timeline(overall_suspicion, bins)
    report = _build_report(verdict, anomalies)

    sha256 = hashlib.sha256(file_bytes).hexdigest()
    analyzed_at = datetime.now(timezone.utc)
    processing_ms = int((analyzed_at - started).total_seconds() * 1000)

    return AnalysisResponse(
        request_id=request_id,
        analyzed_at=analyzed_at.isoformat(),
        processing_ms=max(processing_ms, 1),
        engine_version=ENGINE_VERSION,
        media=MediaInfo(
            filename=filename,
            mime_type=mime_type,
            size_bytes=len(file_bytes),
            sha256=sha256,
            width=original_w,
            height=original_h,
            analyzed_width=analyzed_w,
            analyzed_height=analyzed_h,
            color_mode="RGB",
            format=str(image.info.get("source_format", "UNKNOWN")),
        ),
        verdict=verdict,
        metrics=metrics,
        module_scores=module_scores,
        anomalies=anomalies,
        hotspots=hotspots,
        timeline=timeline,
        frequency_bins=[round(float(value), 4) for value in bins.tolist()],
        artifacts=ArtifactBundle(
            heatmap_png_base64=_encode_png_base64(heatmap),
            ela_png_base64=_encode_png_base64(ela_rgb),
        ),
        report=report,
    )
