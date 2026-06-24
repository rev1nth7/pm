# Project Management MVP container.
# Stage 1 builds the static Next.js frontend; stage 2 runs the FastAPI backend,
# which serves the API under /api and the exported frontend at /.

# Stage 1: build the static frontend (produces frontend/out).
FROM node:22-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend serving the API and the exported frontend.
FROM python:3.12-slim

# Install uv (the Python package manager used for this project).
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies first for better layer caching.
COPY backend/pyproject.toml ./
RUN uv sync --no-dev

# Copy the application code, then drop the built frontend into the served dir.
COPY backend/ ./
COPY --from=frontend /frontend/out ./app/static

# SQLite database location. Mount a volume here to persist across restarts.
ENV DATABASE_PATH=/app/data/app.db

EXPOSE 8000

CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
