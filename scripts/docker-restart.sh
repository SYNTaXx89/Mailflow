#!/bin/bash
# Mailflow Docker Restart Script

set -e

# Get the script directory and navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root directory
cd "$PROJECT_ROOT"

echo "🐳 Restarting Mailflow Docker Environment..."
echo "📁 Working from: $(pwd)"

# Function to show usage
show_usage() {
    echo "Usage: $0 [dev|prod|test]"
    echo ""
    echo "Options:"
    echo "  dev   - Restart development environment (default)"
    echo "  prod  - Restart production environment"
    echo "  test  - Restart test environment"
    echo ""
    echo "Examples:"
    echo "  $0        # Restart dev environment"
    echo "  $0 dev    # Restart dev environment"
    echo "  $0 prod   # Restart prod environment"
    echo "  $0 test   # Restart test environment"
}

# Parse command line arguments
ENVIRONMENT="dev"
if [ $# -gt 0 ]; then
    case $1 in
        dev|development)
            ENVIRONMENT="dev"
            ;;
        prod|production)
            ENVIRONMENT="prod"
            ;;
        test|testing)
            ENVIRONMENT="test"
            ;;
        -h|--help|help)
            show_usage
            exit 0
            ;;
        *)
            echo "❌ Invalid environment: $1"
            show_usage
            exit 1
            ;;
    esac
fi

# Set compose file based on environment
case $ENVIRONMENT in
    dev)
        COMPOSE_FILE="docker-compose.dev.yml"
        echo "🔄 Restarting DEVELOPMENT environment..."
        ;;
    prod)
        COMPOSE_FILE="docker-compose.yml"
        echo "🔄 Restarting PRODUCTION environment..."
        ;;
    test)
        COMPOSE_FILE="docker-compose.test.yml"
        echo "🔄 Restarting TEST environment..."
        ;;
esac

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Docker Compose file not found: $COMPOSE_FILE"
    exit 1
fi

echo "📄 Using compose file: $COMPOSE_FILE"

# Function to restart services
restart_services() {
    echo "🛑 Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" down
    
    echo "🧹 Removing orphaned containers..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans
    
    echo "🚀 Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d --build
    
    echo "📊 Showing container status..."
    docker-compose -f "$COMPOSE_FILE" ps
}

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "🔍 Final container status:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Set up cleanup trap
trap cleanup EXIT

# Main restart logic
echo "🔄 Restarting Mailflow ($ENVIRONMENT)..."
restart_services

echo ""
echo "✅ Mailflow ($ENVIRONMENT) restart completed!"

# Show environment-specific URLs
case $ENVIRONMENT in
    dev)
        echo "🌐 Frontend: http://localhost:5173"
        echo "📧 Backend API: http://localhost:3001/api"
        echo "🔧 Setup Wizard: http://localhost:5173 (if not configured)"
        ;;
    prod)
        echo "🌐 Application: http://localhost:3000"
        echo "📧 API: http://localhost:3000/api"
        echo "🔧 Setup Wizard: http://localhost:3000 (if not configured)"
        ;;
    test)
        echo "🧪 Test environment running"
        echo "📧 API: http://localhost:3001/api"
        ;;
esac

echo ""
echo "💡 Useful commands:"
echo "  docker-compose -f $COMPOSE_FILE logs -f    # Follow logs"
echo "  docker-compose -f $COMPOSE_FILE ps         # Show status"
echo "  docker-compose -f $COMPOSE_FILE down       # Stop services"