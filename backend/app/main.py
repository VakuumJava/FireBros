from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import API_PREFIX, API_VERSION, Settings
from .errors import DomainError
from .middleware import SECURITY_HEADERS, RequestGuard
from .routers import aoi, meta


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings.from_env()

    application = FastAPI(
        title="Ala-Too Fire Calendar API",
        version=API_VERSION,
        description=(
            "Harmonized MODIS and VIIRS hotspot series for Kyrgyzstan and neighbouring "
            "countries. Unit everywhere: hotspot_days_1km."
        ),
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=None,
        redoc_url=None,
    )
    application.state.settings = config
    if config.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(config.cors_origins),
            allow_methods=["GET"],
            allow_headers=["*"],
            expose_headers=[
                "X-Row-Count",
                "X-Unit",
                "Content-Disposition",
                "X-Data-Source",
                "X-Method-Version",
            ],
        )
    application.add_middleware(RequestGuard, max_concurrent_queries=config.max_concurrent_queries)

    application.add_exception_handler(DomainError, _domain_error)
    application.add_exception_handler(Exception, _unexpected_error)
    application.include_router(meta.router, prefix=API_PREFIX)
    application.include_router(aoi.router, prefix=API_PREFIX)
    static_dir = os.environ.get("FIREBROS_STATIC_DIR")
    if static_dir and Path(static_dir).is_dir():
        application.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    return application


async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


async def _unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logging.getLogger(__name__).error("request failed", exc_info=exc)
    return JSONResponse(
        {"detail": "internal server error"},
        status_code=500,
        headers={**SECURITY_HEADERS, "Cache-Control": "no-store"},
    )


app = create_app()
