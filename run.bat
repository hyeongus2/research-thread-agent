@echo off
echo Starting Research Thread Agent...
echo.

echo [Terminal 1] FastAPI backend - http://localhost:8000
start "FastAPI Backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn api.main:app --reload --port 8000"

echo [Terminal 2] Next.js frontend - http://localhost:3000
start "Next.js Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers starting in separate windows.
echo Open http://localhost:3000 once Next.js finishes compiling.
echo Close the two terminal windows to stop the servers.
