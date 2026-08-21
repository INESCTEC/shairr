#!/usr/bin/env bash
set -e  # exit on error

VENV_DIR="venv"
FIRST_RUN=false

# Find the best python executable
if command -v python3.12 &>/dev/null; then
    PYTHON_BIN="python3.12"
elif command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
else
    echo "Error: Python 3 is not installed."
    exit 1
fi

# Create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Virtual environment not found. Creating one with $PYTHON_BIN..."
    $PYTHON_BIN -m venv "$VENV_DIR"
    echo "Virtual environment created."
    FIRST_RUN=true
fi

# Activate venv
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    source "$VENV_DIR/Scripts/activate"
else
    source "$VENV_DIR/bin/activate"
fi

# Install requirements only on first run
if [ "$FIRST_RUN" = true ] && [ -f "requirements.txt" ]; then
    echo "Installing dependencies from requirements.txt..."
    pip install -r requirements.txt
fi

# Run main.py
echo "Running main.py with venv Python..."
python3 main.py
