#!/usr/bin/env python3
"""
AEGIS Backend — Deepfake Detection Demo Script
Team BrainByte — RockVerse Hackathon 2026

Usage:
    python demo.py image.jpg
    python demo.py image.jpg --verbose
    python demo.py image.jpg --json

Model (downloaded on first run, ~330MB):
    prithivMLmods/Deepfake-vs-Real-Image-Detection
    ViT-based binary classifier trained on deepfake datasets.
    Source: https://huggingface.co/prithivMLmods/Deepfake-vs-Real-Image-Detection

Fallback:
    If the model cannot be downloaded (offline / no GPU RAM),
    the script falls back to the deterministic forensic ensemble:
    ELA + Laplacian + local block variance + high-frequency energy.
    This is the same pipeline as the AEGIS browser engine.
"""

import sys
import os
import json
import time
import argparse
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

# ── CONFIG ────────────────────────────────────────────────────────────────────

# Real HuggingFace model — ViT-based deepfake classifier
HF_MODEL_ID   = "prithivMLmods/Deepfake-vs-Real-Image-Detection"
HF_TASK       = "image-classification"
CACHE_DIR     = Path.home() / ".aegis" / "models"

THRESHOLD_HI  = 0.85
THRESHOLD_LO  = 0.60
THRESHOLD_IN  = 0.40

# ── FORENSIC ENGINE ───────────────────────────────────────────────────────────

def run_ela(img_path: str, quality: int = 75) -> tuple:
    from io import BytesIO
    img = Image.open(img_path).convert('RGB')
    buf = BytesIO()
    img.save(buf, format='JPEG', quality=quality)
    buf.seek(0)
    recomp = Image.open(buf).convert('RGB')
    orig = np.array(img, dtype=np.float32)
    comp = np.array(recomp, dtype=np.float32)
    diff = np.abs(orig - comp)
    ela_mean = float(diff.mean())
    return ela_mean, diff.mean(axis=2)


def run_laplacian(img_path: str) -> float:
    img = Image.open(img_path).convert('L')
    lap = img.filter(ImageFilter.Kernel(size=3, kernel=[-1,-1,-1,-1,8,-1,-1,-1,-1], scale=1))
    return float(np.abs(np.array(lap, dtype=np.float32) / 255.0).mean())


def run_local_variance(img_path: str, bs: int = 8) -> float:
    img  = Image.open(img_path).convert('L')
    arr  = np.array(img, dtype=np.float32) / 255.0
    H, W = arr.shape
    vars_: list = []
    for y in range(0, H - bs, bs):
        for x in range(0, W - bs, bs):
            vars_.append(float(np.var(arr[y:y+bs, x:x+bs])))
    return float(np.mean(vars_)) if vars_ else 0.0


def run_hf_energy(img_path: str) -> float:
    img = Image.open(img_path).convert('L')
    arr = np.array(img, dtype=np.float32) / 255.0
    sm  = np.array(img.filter(ImageFilter.GaussianBlur(1)), dtype=np.float32) / 255.0
    return float(np.mean((arr - sm) ** 2))


def forensic_ensemble(ela: float, edge: float, var_: float, hf: float) -> float:
    ela_f  = min(1.0, ela   / 14.0)
    var_f  = 1.0 - min(1.0, var_  / 0.045)
    edge_f = min(1.0, edge  / 0.09)
    hf_f   = min(1.0, hf    / 0.0045)
    return ela_f*0.35 + var_f*0.28 + edge_f*0.22 + hf_f*0.15


# ── NEURAL MODEL ──────────────────────────────────────────────────────────────

def try_neural_model(img_path: str) -> float | None:
    """
    Attempts to run prithivMLmods/Deepfake-vs-Real-Image-Detection.
    Returns probability of being a deepfake (0-1), or None if unavailable.
    """
    try:
        from transformers import pipeline
        print(f"[AEGIS] Loading model: {HF_MODEL_ID}")
        print("[AEGIS] (First run downloads ~330MB — subsequent runs use cache)")
        classifier = pipeline(
            HF_TASK,
            model=HF_MODEL_ID,
            cache_dir=str(CACHE_DIR),
        )
        img = Image.open(img_path).convert('RGB')
        results = classifier(img)
        # Model outputs labels like 'Fake'/'Real' or 'deepfake'/'real'
        for r in results:
            label = r['label'].lower()
            if 'fake' in label or 'deepfake' in label or 'artificial' in label:
                return float(r['score'])
            if 'real' in label or 'authentic' in label:
                return 1.0 - float(r['score'])
        return None
    except ImportError:
        print("[AEGIS] transformers not installed — pip install transformers torch")
        return None
    except Exception as e:
        print(f"[AEGIS] Model unavailable ({type(e).__name__}) — using forensic ensemble only")
        return None


# ── VERDICT ───────────────────────────────────────────────────────────────────

def to_verdict(score: float) -> dict:
    pct = round(score * 100, 1)
    if score < THRESHOLD_IN:
        return {"label": "REAL",                       "confidence": pct, "risk": "low"}
    elif score < THRESHOLD_LO:
        return {"label": "INCONCLUSIVE",               "confidence": pct, "risk": "moderate"}
    elif score < THRESHOLD_HI:
        return {"label": "LIKELY_SYNTHETIC",           "confidence": pct, "risk": "high"}
    else:
        return {"label": "HIGH_CONFIDENCE_SYNTHETIC",  "confidence": pct, "risk": "critical"}


# ── MAIN ──────────────────────────────────────────────────────────────────────

def analyze(img_path: str, verbose: bool = False) -> dict:
    if not os.path.exists(img_path):
        raise FileNotFoundError(f"Image not found: {img_path}")

    t0 = time.perf_counter()
    print(f"\n[AEGIS] Analyzing: {img_path}")
    print("[AEGIS] Running forensic pipeline...")

    ela_score, _ = run_ela(img_path)
    edge_score   = run_laplacian(img_path)
    var_score    = run_local_variance(img_path)
    hf_score     = run_hf_energy(img_path)
    forensic_p   = forensic_ensemble(ela_score, edge_score, var_score, hf_score)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    model_p   = try_neural_model(img_path)
    engine    = "ensemble_only"
    if model_p is not None:
        final_p = model_p * 0.60 + forensic_p * 0.40
        engine  = f"neural+forensic ({HF_MODEL_ID})"
    else:
        final_p = forensic_p
        engine  = "forensic_ensemble (ELA+Laplacian+Variance+HF)"

    verdict      = to_verdict(final_p)
    inference_ms = round((time.perf_counter() - t0) * 1000, 1)

    result = {
        "verdict":      verdict["label"],
        "confidence":   verdict["confidence"],
        "risk_level":   verdict["risk"],
        "inference_ms": inference_ms,
        "engine":       engine,
    }
    if verbose:
        result["raw"] = {
            "ela_mean":       round(ela_score, 4),
            "edge_sharpness": round(edge_score, 6),
            "local_variance": round(var_score, 6),
            "hf_energy":      round(hf_score, 6),
            "forensic_prob":  round(forensic_p, 4),
            "model_prob":     round(model_p, 4) if model_p is not None else None,
            "final_prob":     round(final_p, 4),
        }
    return result


def main():
    parser = argparse.ArgumentParser(description="AEGIS deepfake detection demo")
    parser.add_argument("image",     help="Path to image (JPEG, PNG, WebP)")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--json",    action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    try:
        r = analyze(args.image, verbose=args.verbose)
        if args.json:
            print(json.dumps(r, indent=2)); return

        icons = {"REAL":"✅","INCONCLUSIVE":"⚠️ ","LIKELY_SYNTHETIC":"🔶","HIGH_CONFIDENCE_SYNTHETIC":"🔴"}
        print(f"\n{'═'*52}")
        print(f"  {icons.get(r['verdict'],'?')}  {r['verdict'].replace('_',' ')}")
        print(f"      Confidence : {r['confidence']}%")
        print(f"      Risk level : {r['risk_level'].upper()}")
        print(f"      Inference  : {r['inference_ms']}ms")
        print(f"      Engine     : {r['engine']}")
        print(f"{'═'*52}")
        if args.verbose and 'raw' in r:
            print("\n  Raw scores:")
            for k, v in r['raw'].items():
                if v is not None: print(f"    {k:<22} {v}")
        print()
    except FileNotFoundError as e:
        print(f"\n[AEGIS] Error: {e}"); sys.exit(1)
    except Exception as e:
        print(f"\n[AEGIS] Unexpected error: {e}"); sys.exit(1)


if __name__ == "__main__":
    main()
