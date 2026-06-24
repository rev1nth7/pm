@echo off
REM Build and run the Project Management MVP container (Windows).
cd /d "%~dp0.."
docker build -t pm-mvp . || exit /b 1
docker run -d --rm --name pm-mvp -p 8000:8000 -v pm-data:/app/data pm-mvp || exit /b 1
echo Started on http://localhost:8000
