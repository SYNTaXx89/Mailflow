#!/bin/bash
# MailFlow Docker Management Script
# Advanced Docker operations for MailFlow

set -e

# Get the script directory and navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root directory
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo "MailFlow Docker Management Script"
    echo ""
    echo "Usage: $0 <command> [environment]"
    echo ""
    echo "Commands:"
    echo "  restart [env]    - Restart Docker services"
    echo "  stop [env]       - Stop Docker services"
    echo "  start [env]      - Start Docker services"
    echo "  rebuild [env]    - Rebuild and restart services"
    echo "  logs [env]       - Show logs"
    echo "  status [env]     - Show container status"
    echo "  clean [env]      - Clean up containers and volumes"
    echo "  reset [env]      - Reset environment (stop, clean, rebuild)"
    echo ""
    echo "Environments:"
    echo "  dev    - Development environment (default)"
    echo "  prod   - Production environment"
    echo "  test   - Test environment"
    echo ""
    echo "Examples:"
    echo "  $0 restart         # Restart dev environment"
    echo "  $0 rebuild prod    # Rebuild production environment"
    echo "  $0 logs dev        # Show dev environment logs"
    echo "  $0 clean           # Clean dev environment"
    echo "  $0 reset prod      # Reset production environment"
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT="dev"

if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

COMMAND=$1
if [ $# -gt 1 ]; then
    case $2 in
        dev|development)
            ENVIRONMENT="dev"
            ;;
        prod|production)
            ENVIRONMENT="prod"
            ;;
        test|testing)
            ENVIRONMENT="test"
            ;;
        *)
            echo -e "${RED}❌ Invalid environment: $2${NC}"
            show_usage
            exit 1
            ;;
    esac
fi

# Set compose file based on environment
case $ENVIRONMENT in
    dev)
        COMPOSE_FILE="docker-compose.dev.yml"
        ENV_NAME="DEVELOPMENT"
        ;;
    prod)
        COMPOSE_FILE="docker-compose.yml"
        ENV_NAME="PRODUCTION"
        ;;
    test)
        COMPOSE_FILE="docker-compose.test.yml"
        ENV_NAME="TEST"
        ;;
esac

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Docker Compose file not found: $COMPOSE_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}🐳 MailFlow Docker Management${NC}"
echo -e "${BLUE}📁 Working from: $(pwd)${NC}"
echo -e "${BLUE}📄 Using: $COMPOSE_FILE${NC}"
echo -e "${BLUE}🎯 Environment: $ENV_NAME${NC}"
echo ""

# Function to show container status
show_status() {
    echo -e "${YELLOW}📊 Container Status:${NC}"
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
}

# Function to show logs
show_logs() {
    echo -e "${YELLOW}📋 Following logs (Ctrl+C to stop):${NC}"
    docker-compose -f "$COMPOSE_FILE" logs -f
}

# Function to start services
start_services() {
    echo -e "${GREEN}🚀 Starting services...${NC}"
    docker-compose -f "$COMPOSE_FILE" up -d
    show_status
}

# Function to stop services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    docker-compose -f "$COMPOSE_FILE" down
    show_status
}

# Function to restart services
restart_services() {
    echo -e "${YELLOW}🔄 Restarting services...${NC}"
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" up -d
    show_status
}

# Function to rebuild services
rebuild_services() {
    echo -e "${YELLOW}🔨 Rebuilding services...${NC}"
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    docker-compose -f "$COMPOSE_FILE" up -d
    show_status
}

# Function to clean up
clean_environment() {
    echo -e "${YELLOW}🧹 Cleaning up environment...${NC}"
    
    # Stop and remove containers
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans
    
    # Remove dangling images
    echo -e "${YELLOW}🗑️ Removing dangling images...${NC}"
    docker image prune -f
    
    # Remove unused volumes (be careful with this)
    echo -e "${YELLOW}🗑️ Removing unused volumes...${NC}"
    docker volume prune -f
    
    # Remove unused networks
    echo -e "${YELLOW}🗑️ Removing unused networks...${NC}"
    docker network prune -f
    
    echo -e "${GREEN}✅ Cleanup completed!${NC}"
    show_status
}

# Function to reset environment
reset_environment() {
    echo -e "${RED}⚠️  WARNING: This will stop all services and clean up data!${NC}"
    echo -e "${YELLOW}Press Ctrl+C to cancel or Enter to continue...${NC}"
    read -r
    
    echo -e "${YELLOW}🔄 Resetting environment...${NC}"
    stop_services
    clean_environment
    rebuild_services
    
    echo -e "${GREEN}✅ Environment reset completed!${NC}"
}

# Function to show environment URLs
show_urls() {
    echo -e "${GREEN}🌐 Environment URLs:${NC}"
    case $ENVIRONMENT in
        dev)
            echo "  Frontend: http://localhost:5173"
            echo "  Backend API: http://localhost:3001/api"
            echo "  Setup Wizard: http://localhost:5173 (if not configured)"
            ;;
        prod)
            echo "  Application: http://localhost:3000"
            echo "  API: http://localhost:3000/api"
            echo "  Setup Wizard: http://localhost:3000 (if not configured)"
            ;;
        test)
            echo "  Test environment running"
            echo "  API: http://localhost:3001/api"
            ;;
    esac
    echo ""
}

# Function to show useful commands
show_commands() {
    echo -e "${BLUE}💡 Useful commands:${NC}"
    echo "  docker-compose -f $COMPOSE_FILE logs -f    # Follow logs"
    echo "  docker-compose -f $COMPOSE_FILE exec <service> sh  # Shell into container"
    echo "  docker-compose -f $COMPOSE_FILE ps         # Show status"
    echo "  docker system df                           # Show Docker disk usage"
    echo ""
}

# Main command execution
case $COMMAND in
    restart)
        restart_services
        show_urls
        show_commands
        ;;
    stop)
        stop_services
        ;;
    start)
        start_services
        show_urls
        show_commands
        ;;
    rebuild)
        rebuild_services
        show_urls
        show_commands
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    clean)
        clean_environment
        ;;
    reset)
        reset_environment
        show_urls
        show_commands
        ;;
    -h|--help|help)
        show_usage
        ;;
    *)
        echo -e "${RED}❌ Invalid command: $COMMAND${NC}"
        show_usage
        exit 1
        ;;
esac