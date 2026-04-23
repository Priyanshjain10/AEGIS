from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analysis import AnalysisError, analyze_image_bytes
from .schemas import AnalysisResponse, HealthResponse

APP_VERSION = "1.0.0"
MAX_FILE_BYTES = 10 * 1024 * 1024
SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
}

app = FastAPI(
    title="AEGIS Forensics API",
    version=APP_VERSION,
    description="Deterministic image forensics backend for AEGIS demo",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="aegis-backend", version=APP_VERSION)


@app.post("/api/v1/analyze/image", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)) -> AnalysisResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{mime_type}'. Use an image format like JPEG or PNG.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 10MB."
        )

    try:
        return analyze_image_bytes(
            file_bytes=file_bytes,
            filename=file.filename,
            mime_type=mime_type,
        )
    except AnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Analysis failed") from exc
