from __future__ import annotations

import asyncio

from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .config import API_PREFIX

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


class RequestGuard:
    def __init__(self, app: ASGIApp, max_concurrent_queries: int) -> None:
        self.app = app
        self.slots = asyncio.Semaphore(max_concurrent_queries)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope["path"]
        is_api = path == API_PREFIX or path.startswith(f"{API_PREFIX}/")

        async def send_response(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.update(SECURITY_HEADERS)
                headers["Cache-Control"] = _cache_policy(path, is_api)
            await send(message)

        if len(scope.get("query_string", b"")) > MAX_QUERY_BYTES:
            await JSONResponse({"detail": "query is too long"}, status_code=414)(
                scope, receive, send_response
            )
            return
        if not is_api:
            await self.app(scope, receive, send_response)
            return
        if self.slots.locked():
            await JSONResponse(
                {"detail": "server is busy; retry shortly"},
                status_code=503,
                headers={"Retry-After": "2"},
            )(scope, receive, send_response)
            return

        async with self.slots:
            await self.app(scope, receive, send_response)


def _cache_policy(path: str, is_api: bool) -> str:
    if is_api:
        return "no-store"
    if path.startswith("/assets/"):
        return "public, max-age=31536000, immutable"
    return "no-cache"
