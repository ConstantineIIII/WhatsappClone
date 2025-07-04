#!/bin/bash

# WhatsApp Clone Database Startup Script

set -e

echo "🚀 Starting WhatsApp Clone Database Services..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it first."
    exit 1
fi

# Function to check if ports are available
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use. $service might not start properly."
        return 1
    fi
    return 0
}

# Check ports
echo "🔍 Checking port availability..."
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"

# Start services
echo "📦 Starting containers..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo "🔍 Checking service status..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running successfully!"
    
    echo ""
    echo "📊 Service Status:"
    docker-compose ps
    
    echo ""
    echo "🔗 Connection Details:"
    echo "PostgreSQL: localhost:5432"
    echo "Redis: localhost:6379"
    echo "Database: whatsapp_clone"
    echo "Username: whatsapp_user"
    echo "Password: whatsapp_password"
    
    echo ""
    echo "📝 Useful Commands:"
    echo "  View logs: docker-compose logs"
    echo "  Stop services: docker-compose down"
    echo "  Connect to PostgreSQL: docker exec -it whatsapp_clone_db psql -U whatsapp_user -d whatsapp_clone"
    echo "  Connect to Redis: docker exec -it whatsapp_clone_redis redis-cli"
    
else
    echo "❌ Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi 