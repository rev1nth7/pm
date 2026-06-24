#!/usr/bin/env sh
# Build and run the Project Management MVP container (Mac/Linux).
set -e
cd "$(dirname "$0")/.."
docker build -t pm-mvp .
docker run -d --rm --name pm-mvp -p 8000:8000 -v pm-data:/app/data pm-mvp
echo "Started on http://localhost:8000"
