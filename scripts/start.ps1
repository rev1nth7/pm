# Build and run the Project Management MVP container (Windows PowerShell).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm-mvp .
docker run -d --rm --name pm-mvp -p 8000:8000 -v pm-data:/app/data pm-mvp
Write-Host "Started on http://localhost:8000"
