@echo off
echo Setting up Research Thread Agent...

if not exist ".env" (
    copy .env.example .env
    echo Created .env from .env.example — fill in your API keys before running.
) else (
    echo .env already exists, skipping.
)

if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
) else (
    echo .venv already exists, skipping.
)

echo Activating virtual environment and installing dependencies...
call .venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo Setup complete.
echo Edit .env with your API keys, then run:  run.bat
