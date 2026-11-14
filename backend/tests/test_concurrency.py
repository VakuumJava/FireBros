import asyncio
import threading
from dataclasses import replace

import httpx
from app.deps import get_store
from app.main import create_app


def test_busy_server_returns_retry_without_queueing(settings):
    app = create_app(replace(settings, max_concurrent_queries=1))

    async def verify():
        entered, release = asyncio.Event(), asyncio.Event()

        @app.get("/api/v1/slow-check")
        async def slow_check():
            entered.set()
            await release.wait()
            return {"done": True}

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            first = asyncio.create_task(client.get("/api/v1/slow-check"))
            await asyncio.wait_for(entered.wait(), timeout=2)
            try:
                second = await client.get("/api/v1/meta/health")
                assert second.status_code == 503
                assert second.headers["retry-after"] == "2"
            finally:
                release.set()
            assert (await first).status_code == 200

    asyncio.run(verify())


def test_static_files_do_not_wait_for_query_slots(settings, tmp_path, monkeypatch):
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<!doctype html><title>atlas</title>")
    monkeypatch.setenv("FIREBROS_STATIC_DIR", str(static))
    app = create_app(replace(settings, max_concurrent_queries=1))
    entered, release = threading.Event(), threading.Event()

    class BlockingStore:
        source = "mock"

        def records(self, *_):
            entered.set()
            release.wait(5)
            return []

    app.dependency_overrides[get_store] = BlockingStore

    async def verify():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            query = asyncio.create_task(client.get("/api/v1/aoi/top"))
            assert await asyncio.to_thread(entered.wait, 2)
            try:
                assert (await client.get("/")).status_code == 200
                assert (await client.get("/api/v1/meta/region")).status_code == 503
            finally:
                release.set()
            assert (await query).status_code == 200

    asyncio.run(verify())
