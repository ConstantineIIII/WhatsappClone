#!/bin/bash

# WhatsApp Clone Database Deployment Script
# This script handles database setup and migration for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required environment variables are set
check_env_vars() {
    local required_vars=(
        "DATABASE_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Environment variable $var is not set"
            exit 1
        fi
    done
}

# Function to test database connection
test_db_connection() {
    print_status "Testing database connection..."
    
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection established"
        return 0
    else
        print_error "Cannot connect to database"
        return 1
    fi
}

# Function to run migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Run the deployment script
    if psql "$DATABASE_URL" -f ./migrations/deploy.sql; then
        print_success "Database migrations completed successfully"
        return 0
    else
        print_error "Database migrations failed"
        return 1
    fi
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying database deployment..."
    
    # Check if schema_migrations table exists
    if ! psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM schema_migrations;" > /dev/null 2>&1; then
        print_error "Schema migrations table not found"
        return 1
    fi
    
    # Check if admin user exists
    admin_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users WHERE is_admin = true AND email = 'kalel@whatsappclone.com';")
    if [ "$admin_count" -eq 0 ]; then
        print_error "Admin user not found"
        return 1
    fi
    
    # Check if tables exist
    local tables=("users" "chats" "messages" "chat_participants" "message_status" "contacts" "user_sessions")
    for table in "${tables[@]}"; do
        if ! psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM $table;" > /dev/null 2>&1; then
            print_error "Table $table not found"
            return 1
        fi
    done
    
    print_success "Database verification completed"
    return 0
}

# Function to display deployment summary
show_summary() {
    print_status "Deployment Summary:"
    echo "===================="
    
    # Get counts
    local user_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;")
    local chat_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM chats;")
    local message_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM messages;")
    local migration_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM schema_migrations;")
    
    echo "Users: $user_count"
    echo "Chats: $chat_count"
    echo "Messages: $message_count"
    echo "Migrations applied: $migration_count"
    echo "===================="
    
    print_success "Database ready for production!"
}

# Function to show help
show_help() {
    echo "WhatsApp Clone Database Deployment Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help       Show this help message"
    echo "  -t, --test-only  Only test database connection"
    echo "  -v, --verify     Only verify existing deployment"
    echo "  -f, --force      Force deployment even if tables exist"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL     PostgreSQL connection string (required)"
    echo ""
    echo "Examples:"
    echo "  $0                              # Full deployment"
    echo "  $0 --test-only                  # Test connection only"
    echo "  $0 --verify                     # Verify deployment only"
    echo "  DATABASE_URL=postgres://... $0  # With custom database URL"
}

# Parse command line arguments
TEST_ONLY=false
VERIFY_ONLY=false
FORCE_DEPLOY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--test-only)
            TEST_ONLY=true
            shift
            ;;
        -v|--verify)
            VERIFY_ONLY=true
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_status "Starting WhatsApp Clone Database Deployment"
    print_status "==========================================="
    
    # Check environment variables
    check_env_vars
    
    # Test database connection
    if ! test_db_connection; then
        print_error "Database connection failed. Please check your DATABASE_URL."
        exit 1
    fi
    
    # If test-only mode, exit here
    if [ "$TEST_ONLY" = true ]; then
        print_success "Database connection test completed successfully"
        exit 0
    fi
    
    # If verify-only mode, skip migrations
    if [ "$VERIFY_ONLY" = true ]; then
        verify_deployment
        exit $?
    fi
    
    # Check if database is already deployed (unless force deploy)
    if [ "$FORCE_DEPLOY" = false ]; then
        if psql "$DATABASE_URL" -c "SELECT 1 FROM schema_migrations LIMIT 1;" > /dev/null 2>&1; then
            print_warning "Database appears to be already deployed"
            print_status "Use --force to redeploy or --verify to check deployment"
            exit 0
        fi
    fi
    
    # Run migrations
    if ! run_migrations; then
        print_error "Database deployment failed"
        exit 1
    fi
    
    # Verify deployment
    if ! verify_deployment; then
        print_error "Database verification failed"
        exit 1
    fi
    
    # Show summary
    show_summary
    
    print_success "Database deployment completed successfully!"
}

# Run main function
main "$@" 