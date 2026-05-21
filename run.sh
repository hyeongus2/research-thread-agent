#!/bin/bash
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "ERROR: .venv not found. Run setup.sh first."
    exit 1
fi
streamlit run streamlit_app.py
