#!/bin/bash
# MailFlow Development Docker Script

set -e

echo "🐳 Starting MailFlow Development Environment..."

# Get the script directory and navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root directory
cd "$PROJECT_ROOT"

echo "📁 Working from: $(pwd)"

# Clean up any old named volumes that might conflict
echo "🧹 Cleaning up old Docker volumes..."
docker volume rm mailflow_mailflow-dev-data 2>/dev/null || true

# Create development data directory if it doesn't exist
mkdir -p ./mailflow-dev-data

# Check if there's an old .mailflow directory that might confuse users
if [ -d "./.mailflow" ]; then
    echo "⚠️  Found old .mailflow directory in project root"
    echo "📝 Data will now be stored in ./mailflow-dev-data/"
    echo "🗑️  You can safely remove ./.mailflow if you want to start fresh"
fi

# Start development environment
docker-compose -f docker-compose.dev.yml up --build

echo "✅ Development environment started!"
echo "📧 Backend API: http://localhost:3001/api"
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Setup Wizard: http://localhost:5173 (if not configured)"