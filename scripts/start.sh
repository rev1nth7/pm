#!/usr/bin/env sh
# Build and run the Project Management MVP container (Mac/Linux).
set -e
cd "$(dirname "$0")/.."
docker build -t pm-mvp .
# Pass OPENAI_API_KEY (and optional OPENAI_MODEL) from the root .env into the container.
ENV_ARGS=""
[ -f .env ] && ENV_ARGS="--env-file .env"
docker run -d --rm --name pm-mvp -p 8000:8000 -v pm-data:/app/data $ENV_ARGS pm-mvp
echo "Started on http://localhost:8000"
