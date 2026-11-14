from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import API_PREFIX, API_VERSION, Settings
from .errors import DomainError
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
    )
    application.state.settings = config

    if config.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(config.cors_origins),
            allow_methods=["GET"],
            allow_headers=["*"],
            expose_headers=["X-Row-Count", "X-Unit", "Content-Disposition"],
        )

    application.add_exception_handler(DomainError, _domain_error)
    application.include_router(meta.router, prefix=API_PREFIX)
    application.include_router(aoi.router, prefix=API_PREFIX)
    return application


async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


app = create_app()
