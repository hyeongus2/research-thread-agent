@echo off
echo Starting Research Thread Agent...
echo.

set API_PORT=8000
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if "%%A"=="API_PORT" set API_PORT=%%B
    )
)

echo [Terminal 1] FastAPI backend - http://localhost:%API_PORT%
start "FastAPI Backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn api.main:app --reload --host 0.0.0.0 --port %API_PORT%"

echo [Terminal 2] Next.js frontend - http://localhost:3000
start "Next.js Frontend" cmd /k "cd frontend && set NEXT_PUBLIC_API_PORT=%API_PORT% && npm run dev"

echo.
echo Both servers starting in separate windows.
echo Open http://localhost:3000 once Next.js finishes compiling.
echo Close the two terminal windows to stop the servers.
