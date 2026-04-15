from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_recipes():
    return []


@router.get("/{recipe_id}")
async def get_recipe(recipe_id: str):
    return {}


@router.post("/", status_code=201)
async def create_recipe(data: dict):
    return data


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(recipe_id: str):
    pass
