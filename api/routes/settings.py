from __future__ import annotations

from fastapi import APIRouter

from api.env_writer import get_masked_env, write_env
from api.schemas import SettingsResponse, SettingsUpdate

router: APIRouter = APIRouter()


@router.get("/settings")
def get_settings() -> SettingsResponse:
    values, masked_keys = get_masked_env()
    return SettingsResponse(values=values, masked_keys=masked_keys)


@router.put("/settings")
def update_settings(body: SettingsUpdate) -> dict[str, str]:
    write_env(body.values)
    return {"status": "saved"}
