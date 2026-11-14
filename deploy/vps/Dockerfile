FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FIREBROS_STATIC_DIR=/app/frontend/dist

WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 firebros
COPY backend/app/ ./backend/app/
COPY contracts/ ./contracts/
COPY frontend/dist/ ./frontend/dist/

USER firebros
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/meta/health', timeout=3)"
CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000", "--limit-concurrency", "32", "--timeout-keep-alive", "5", "--no-server-header"]
