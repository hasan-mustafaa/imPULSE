from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import hospitals, recommend

settings = get_settings()

app = FastAPI(
    title="imPULSE API",
    description="Smart hospital recommendation engine for Calgary",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hospitals.router)
app.include_router(recommend.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
