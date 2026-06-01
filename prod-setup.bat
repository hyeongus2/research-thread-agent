@echo off
setlocal

echo ============================================
echo  Research Thread Agent - Production Setup
echo ============================================
echo.

REM ----- Prereq check -----
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: node not found in PATH. Install Node.js 18+ first.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: .venv not found. Run setup.bat first.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo ERROR: frontend\node_modules not found. Run setup.bat first.
    pause
    exit /b 1
)

if not exist ".env" (
    echo WARNING: .env not found. Backend may fail without GITHUB_TOKEN.
    echo Press any key to continue anyway, or Ctrl+C to abort.
    pause
)

REM ----- Step 1: Production build -----
echo [1/4] Building frontend ^(production^) ...
cd frontend
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: npm run build failed. See messages above.
    cd ..
    pause
    exit /b 1
)
cd ..
echo Build done.
echo.

REM ----- Step 2: Start backend in a new window -----
echo [2/4] Starting FastAPI backend on port 8000 ...
start "FastAPI backend" cmd /k ".venv\Scripts\activate.bat && uvicorn api.main:app --port 8000"

echo Waiting for backend to come up ...
timeout /t 5 /nobreak >nul

REM ----- Step 3: Start frontend (production) in a new window -----
echo [3/4] Starting Next.js (production) on port 3000 ...
start "Next.js prod" cmd /k "cd frontend && npm start"

echo Waiting for frontend to come up ...
timeout /t 8 /nobreak >nul

REM ----- Step 4: Warm caches -----
echo [4/4] Warming caches ^(trending + figures^) ...
echo This may take 1-3 minutes depending on network.
echo.
call .venv\Scripts\activate.bat
python scripts\warm_cache.py
if errorlevel 1 (
    echo.
    echo WARNING: Cache warming had issues. The app still works,
    echo but first paint may be slower for visitors.
)

echo.
echo ============================================
echo  Ready.  Open http://localhost:3000
echo ============================================
echo.
echo Two server windows are running:
echo   - FastAPI backend  ^(close to stop backend^)
echo   - Next.js prod     ^(close to stop frontend^)
echo.
echo For external access ^(QR demo^), run in another window:
echo   cloudflared tunnel --url http://localhost:3000
echo.
pause
