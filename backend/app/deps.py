from __future__ import annotations

from fastapi import Depends, Request

from .config import Settings
from .store import Store, store_for


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_store(settings: Settings = Depends(get_settings)) -> Store:
    return store_for(settings)
