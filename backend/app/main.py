from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import recipes, import_, planner, voice

app = FastAPI(title="Mise API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


app.include_router(recipes.router, prefix="/recipes", tags=["recipes"])
app.include_router(import_.router, prefix="/import", tags=["import"])
app.include_router(planner.router, prefix="/planner", tags=["planner"])
app.include_router(voice.router, prefix="/voice", tags=["voice"])


@app.get("/health")
async def health():
    return {"status": "ok"}
