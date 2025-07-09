#!/bin/bash
# MailFlow Testing Docker Script

set -e

echo "🧪 Running MailFlow Tests in Docker..."

# Run tests
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Clean up test containers
docker-compose -f docker-compose.test.yml down --volumes

echo "✅ Tests completed!"