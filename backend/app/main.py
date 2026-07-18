from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.routers import auth, workspaces, documents, chat, brain, timeline, hud, explain, agent
from app.services.file_watcher import start_watcher
from app.services.batch_processor import run_batch_processor
from app.services.reflection_engine import run_reflection_engine
import asyncio
import logging

logging.basicConfig(level=logging.INFO)

# Alembic handles migrations now

observer = None
background_tasks = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup (robust fallback for local execution / SQLite)
    try:
        from app.db.session import engine, Base
        Base.metadata.create_all(bind=engine)
        logging.info("Database tables initialized successfully.")
    except Exception as db_err:
        logging.warning(f"Database table initialization failed: {db_err}")

    global observer
    observer = start_watcher()
    
    # Start background processors
    task1 = asyncio.create_task(run_batch_processor())
    task2 = asyncio.create_task(run_reflection_engine())
    background_tasks.add(task1)
    background_tasks.add(task2)
    
    yield
    
    if observer:
        observer.stop()
        observer.join()
    
    for task in background_tasks:
        task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(workspaces.router, prefix=f"{settings.API_V1_STR}/workspaces", tags=["workspaces"])
app.include_router(documents.router, prefix=f"{settings.API_V1_STR}/workspaces", tags=["documents"])
app.include_router(chat.router, prefix=f"{settings.API_V1_STR}/workspaces", tags=["chat"])
app.include_router(brain.router, prefix=f"{settings.API_V1_STR}/brain", tags=["brain"])
app.include_router(timeline.router, prefix=f"{settings.API_V1_STR}", tags=["timeline"])
app.include_router(hud.router, prefix=f"{settings.API_V1_STR}/hud", tags=["hud"])
app.include_router(explain.router, prefix=f"{settings.API_V1_STR}", tags=["explain"])
app.include_router(agent.router, prefix=f"{settings.API_V1_STR}", tags=["agent"])

@app.get("/")
def root():
    return {"message": "Welcome to J.A.R.V.I.S. API"}
