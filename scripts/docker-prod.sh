#!/bin/bash
# Mailflow Production Docker Script

set -e

echo "🐳 Starting Mailflow Production Environment..."

# Create production data directory if it doesn't exist
mkdir -p ./mailflow-data

# Start production environment
docker-compose up --build -d

echo "✅ Production environment started!"
echo "📧 Mailflow: http://localhost:3000"
echo "🔧 Setup Wizard: http://localhost:3000 (if not configured)"
echo "📊 Logs: docker-compose logs -f mailflow"
echo "🛑 Stop: docker-compose down"