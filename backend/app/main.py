"""FastAPI application entrypoint.

Run:  uvicorn app.main:app --reload --port 8010
Docs: http://localhost:8010/docs  (auto-generated OpenAPI / Swagger UI)
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routers import auth, forms, public, responses, workspaces


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)  # create tables on first boot
    if os.environ.get("SEED_ON_START", "1") == "1":
        from .seed import seed
        with SessionLocal() as db:
            seed(db)  # idempotent: no-op when data already exists
    yield


app = FastAPI(title="Typeform Clone API", version="1.0.0", lifespan=lifespan)

default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
origins = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", ",".join(default_origins)).split(",")
    if o.strip()
]
if not origins:
    origins = default_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):300[0-1]",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(forms.router)
app.include_router(workspaces.router)
app.include_router(responses.router)
app.include_router(public.router)


@app.get("/")
@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "message": "Typeform Clone API is running"}
