from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class UrlImportRequest(BaseModel):
    url: str


class PhotoImportRequest(BaseModel):
    image: str  # base64


@router.post("/url", status_code=201)
async def import_from_url(request: UrlImportRequest):
    # TODO: call services/video_pipeline.py
    return {}


@router.post("/photo", status_code=201)
async def import_from_photo(request: PhotoImportRequest):
    # TODO: call services/photo_pipeline.py
    return {}
