from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_week_plan(weekStart: str):
    return {"weekStart": weekStart, "entries": []}


@router.post("/entries", status_code=201)
async def add_entry(data: dict):
    return data


@router.delete("/entries/{entry_id}", status_code=204)
async def remove_entry(entry_id: str):
    pass


@router.get("/grocery-list")
async def get_grocery_list(weekStart: str):
    return []
