# Build and run the Project Management MVP container (Windows PowerShell).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm-mvp .
# Pass OPENAI_API_KEY (and optional OPENAI_MODEL) from the root .env into the container.
$envArgs = @()
if (Test-Path .env) { $envArgs = @("--env-file", ".env") }
docker run -d --rm --name pm-mvp -p 8000:8000 -v pm-data:/app/data @envArgs pm-mvp
Write-Host "Started on http://localhost:8000"
