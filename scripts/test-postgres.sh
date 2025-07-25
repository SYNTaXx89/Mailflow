#!/bin/bash

# Test PostgreSQL Integration Script
# 
# This script helps test the PostgreSQL integration by providing
# easy commands to start/stop services and run tests.

set -e

COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_NC='\033[0m' # No Color

function print_header() {
    echo -e "${COLOR_BLUE}=====================================${COLOR_NC}"
    echo -e "${COLOR_BLUE} $1 ${COLOR_NC}"
    echo -e "${COLOR_BLUE}=====================================${COLOR_NC}"
}

function print_success() {
    echo -e "${COLOR_GREEN}✅ $1${COLOR_NC}"
}

function print_warning() {
    echo -e "${COLOR_YELLOW}⚠️  $1${COLOR_NC}"
}

function print_error() {
    echo -e "${COLOR_RED}❌ $1${COLOR_NC}"
}

case "$1" in
    "start")
        print_header "Starting PostgreSQL Development Environment"
        echo "This will start:"
        echo "  - PostgreSQL database on port 5432"
        echo "  - Mailflow dev server with PostgreSQL connection"
        echo ""
        docker compose -f docker-compose.dev.yml up -d postgres
        echo ""
        print_success "PostgreSQL started! Waiting for health check..."
        docker compose -f docker-compose.dev.yml exec postgres pg_isready -U mailflow_user -d mailflow_dev
        print_success "PostgreSQL is ready!"
        echo ""
        echo "Connection details:"
        echo "  Host: localhost"
        echo "  Port: 5432"
        echo "  Database: mailflow_dev"
        echo "  User: mailflow_user"
        echo "  Password: mailflow_dev_password"
        echo ""
        echo "Connection URL: postgresql://mailflow_user:mailflow_dev_password@localhost:5432/mailflow_dev"
        ;;
    
    "start-app")
        print_header "Starting Mailflow with PostgreSQL"
        docker compose -f docker-compose.dev.yml up mailflow-dev
        ;;
    
    "start-all")
        print_header "Starting Full Development Environment"
        docker compose -f docker-compose.dev.yml up
        ;;
    
    "pgadmin")
        print_header "Starting with pgAdmin"
        docker compose -f docker-compose.dev.yml --profile pgadmin up
        echo ""
        print_success "Services started!"
        echo "  - Mailflow: http://localhost:3001"
        echo "  - pgAdmin: http://localhost:8080"
        echo "    Login: admin@mailflow.local / admin123"
        ;;
    
    "test-local")
        print_header "Testing PostgreSQL Connection Locally"
        export DATABASE_URL="postgresql://mailflow_user:mailflow_dev_password@localhost:5432/mailflow_dev"
        echo "DATABASE_URL=$DATABASE_URL"
        echo ""
        print_warning "Make sure PostgreSQL is running: $0 start"
        echo ""
        npm run dev:backend
        ;;
    
    "stop")
        print_header "Stopping Development Environment"
        docker compose -f docker-compose.dev.yml down
        print_success "All services stopped"
        ;;
    
    "clean")
        print_header "Cleaning Development Environment"
        docker compose -f docker-compose.dev.yml down -v
        print_success "All services stopped and volumes removed"
        ;;
    
    "logs")
        print_header "Showing Service Logs"
        docker compose -f docker-compose.dev.yml logs -f
        ;;
    
    "status")
        print_header "Service Status"
        docker compose -f docker-compose.dev.yml ps
        ;;
    
    *)
        print_header "PostgreSQL Testing Helper"
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start      - Start PostgreSQL database only"
        echo "  start-app  - Start Mailflow app (requires PostgreSQL running)"
        echo "  start-all  - Start both PostgreSQL and Mailflow"  
        echo "  pgadmin    - Start with pgAdmin for database management"
        echo "  test-local - Test PostgreSQL connection with local backend"
        echo "  stop       - Stop all services"
        echo "  clean      - Stop all services and remove volumes"
        echo "  logs       - Show service logs"
        echo "  status     - Show service status"
        echo ""
        echo "Examples:"
        echo "  $0 start                    # Start PostgreSQL"
        echo "  $0 start-all               # Start everything"
        echo "  $0 pgadmin                 # Start with database UI"
        echo "  $0 test-local              # Test connection locally"
        echo ""
        echo "Testing workflow:"
        echo "  1. $0 start                # Start PostgreSQL"
        echo "  2. $0 test-local           # Test with local backend"
        echo "  3. $0 stop                 # Stop when done"
        ;;
esac