# AEGIS — Browser-Native Deepfake Forensics

Open-source · Browser-native · Explainable · Free forever
RockVerse Hackathon 2026 · BigRock Exchange · AI Domain

Team BrainByte — Priyansh Jain & Tanishka Milind Tapas

---

## What AEGIS does

AEGIS is a browser-native forensic deepfake detection platform. Every byte of analysis runs inside your browser — no file upload, no server, no API key, no privacy risk.

Four forensic algorithms run directly via HTML5 Canvas API:

- Error Level Analysis (ELA) — detects JPEG compression inconsistencies from face-swap compositing
- Laplacian Edge Detection — finds GAN boundary artifacts at face-swap seams  
- Local Block Variance — catches GAN over-smoothing in skin texture regions
- High-Frequency Energy — identifies GAN spectral fingerprints from upsampling

All four scores are fused into a weighted ensemble → verdict → GradCAM-style heatmap showing exactly which regions triggered each algorithm.

Research basis: AAAI 2024 (FreqNet), ECCV 2020 (frequency-aware detection), CVPR 2021 (high-frequency features), Farid et al. (ELA forensics)

---

## Run the web app

npm install
npm run dev
# http://localhost:5173

Deploy: npm run build → drag dist/ to netlify.com/drop

---

## Python backend (proof-of-concept)

cd backend
pip install -r requirements.txt
python demo.py path/to/image.jpg

---

## Chrome Extension

1. Chrome → chrome://extensions → Enable Developer Mode
2. Load unpacked → select chrome-extension/ folder
3. Right-click any image → Scan with AEGIS

---

## Structure

aegis-deepfake-detector/
├── src/lib/analysis.ts      ← ELA + Laplacian + variance + HF engine
├── src/lib/gradcam.ts       ← GradCAM-style Canvas heatmap
├── src/pages/               ← 6-page React Router flow
├── chrome-extension/        ← Working MV3 Chrome Extension
├── backend/demo.py          ← Python proof-of-concept
└── public/frames/           ← 40-frame cinematic intro animation

---

## License

MIT — Team BrainByte — RockVerse Hackathon 2026
