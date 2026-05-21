#!/bin/bash
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "ERROR: .venv not found. Run setup.sh first."
    exit 1
fi

echo "Starting FastAPI backend on http://localhost:8000 ..."
uvicorn api.main:app --reload --port 8000 &
FASTAPI_PID=$!

echo "Starting Next.js frontend on http://localhost:3000 ..."
cd frontend && npm run dev &
NEXT_PID=$!

echo ""
echo "App running at http://localhost:3000"
echo "API docs at  http://localhost:8000/docs"
echo "Press Ctrl+C to stop both servers."

trap "kill $FASTAPI_PID $NEXT_PID 2>/dev/null; exit" INT TERM
wait
