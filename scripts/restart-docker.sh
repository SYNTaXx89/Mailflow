#!/bin/bash
# Restart Docker Desktop on macOS

echo "🐳 Restarting Docker Desktop..."

# Kill Docker Desktop
killall Docker

# Wait a moment
sleep 2

# Start Docker Desktop
open -a Docker

echo "✅ Docker Desktop restarted - wait a moment for it to fully start"