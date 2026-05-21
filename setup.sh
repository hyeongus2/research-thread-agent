#!/bin/bash
echo "Setting up Research Thread Agent..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created .env from .env.example — fill in your API keys before running."
else
    echo ".env already exists, skipping."
fi

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv 2>/dev/null || python -m venv .venv
else
    echo ".venv already exists, skipping."
fi

echo "Activating virtual environment and installing dependencies..."
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "ERROR: Could not find venv activate script. On Windows, use setup.bat instead."
    exit 1
fi

pip install -r requirements.txt

echo ""
echo "Setup complete."
echo "Edit .env with your API keys, then run:  ./run.sh"
