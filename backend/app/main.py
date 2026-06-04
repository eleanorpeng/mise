import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.rate_limit import limiter
from app.routers import recipes, import_, planner, voice, collections, cook_log, profile, recap, chef

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(title="Mise API", version="0.1.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recipes.router, prefix="/recipes", tags=["recipes"])
app.include_router(import_.router, prefix="/import", tags=["import"])
app.include_router(planner.router, prefix="/planner", tags=["planner"])
app.include_router(voice.router, prefix="/voice", tags=["voice"])
app.include_router(collections.router, prefix="/collections", tags=["collections"])
app.include_router(cook_log.router, prefix="/cook-log", tags=["cook-log"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(recap.router, prefix="/recap", tags=["recap"])
app.include_router(chef.router, prefix="/chef", tags=["chef"])


@app.get("/health")
async def health():
    return {"status": "ok"}
