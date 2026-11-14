from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import API_PREFIX, API_VERSION, Settings
from .errors import DomainError
from .routers import aoi, meta

MAX_QUERY_BYTES = 24_000
CONTENT_SECURITY_POLICY = "; ".join(
    (
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://tile.openstreetmap.org",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
    )
)
SECURITY_HEADERS = {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


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
    query_slots = asyncio.Semaphore(config.max_concurrent_queries)

    @application.middleware("http")
    async def protect_requests(request: Request, call_next):
        path = request.url.path
        if len(request.scope.get("query_string", b"")) > MAX_QUERY_BYTES:
            response = JSONResponse({"detail": "query is too long"}, status_code=414)
        elif not path.startswith(API_PREFIX):
            response = await call_next(request)
        elif query_slots.locked():
            response = JSONResponse(
                {"detail": "server is busy; retry shortly"},
                status_code=503,
                headers={"Retry-After": "2"},
            )
        else:
            async with query_slots:
                response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        response.headers["Cache-Control"] = _cache_policy(path)
        return response

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

    application.add_exception_handler(DomainError, _domain_error)
    application.add_exception_handler(Exception, _unexpected_error)
    application.include_router(meta.router, prefix=API_PREFIX)
    application.include_router(aoi.router, prefix=API_PREFIX)
    static_dir = os.environ.get("FIREBROS_STATIC_DIR")
    if static_dir and Path(static_dir).is_dir():
        application.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    return application


def _cache_policy(path: str) -> str:
    if path.startswith(API_PREFIX):
        return "no-store"
    if path.startswith("/assets/"):
        return "public, max-age=31536000, immutable"
    return "no-cache"


async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


async def _unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logging.getLogger(__name__).error("request failed", exc_info=exc)
    return JSONResponse({"detail": "internal server error"}, status_code=500)


app = create_app()
