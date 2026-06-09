#!/bin/bash
if [ -f ".env" ]; then
    set -a; source .env; set +a
fi
API_PORT=${API_PORT:-8000}

if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "ERROR: .venv not found. Run setup.sh first."
    exit 1
fi

echo "Starting FastAPI backend on http://localhost:${API_PORT} ..."
uvicorn api.main:app --reload --host 0.0.0.0 --port "${API_PORT}" &
FASTAPI_PID=$!

echo "Starting Next.js frontend on http://localhost:3000 ..."
cd frontend && NEXT_PUBLIC_API_PORT="${API_PORT}" npm run dev &
NEXT_PID=$!

echo ""
echo "App running at http://localhost:3000"
echo "API docs at  http://localhost:${API_PORT}/docs"
echo "Press Ctrl+C to stop both servers."

trap "kill $FASTAPI_PID $NEXT_PID 2>/dev/null; exit" INT TERM
wait
