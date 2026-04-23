# AEGIS Backend

Standalone Python proof-of-concept for deepfake detection.

## Setup

```bash
pip install -r requirements.txt
python demo.py path/to/image.jpg
```

## What it does

1. Runs 4 forensic algorithms (same as the web app — ELA, Laplacian, variance, HF energy)
2. Attempts to download EfficientNet-B4 pretrained on FaceForensics++ from HuggingFace Hub
3. If model is available: blends neural (60%) + forensic (40%) scores
4. Outputs: verdict, confidence, risk level, inference time, full breakdown

## Example output

```
[AEGIS] Analyzing: deepfake_sample.jpg
[AEGIS] Running forensic pipeline...
[AEGIS] Running EfficientNet-B4 ONNX inference...

══════════════════════════════════════════════════
  🔴  VERDICT: HIGH CONFIDENCE SYNTHETIC
      Confidence: 94.2%
      Risk level: CRITICAL
      Inference:  312.4ms
      Engine:     efficientnet_b4_faceforensics
══════════════════════════════════════════════════
```

## Options

```
python demo.py image.jpg              # basic output
python demo.py image.jpg --verbose    # full forensic breakdown
python demo.py image.jpg --json       # raw JSON output
```

## Without the model

If `onnxruntime` or `huggingface_hub` is not installed, the script falls back to the
same in-browser forensic pipeline — ELA + Laplacian + variance + HF energy ensemble —
which runs with just `pip install Pillow numpy`.
