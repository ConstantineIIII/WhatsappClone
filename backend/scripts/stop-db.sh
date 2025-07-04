#!/bin/bash

# WhatsApp Clone Database Stop Script

set -e

echo "🛑 Stopping WhatsApp Clone Database Services..."

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed."
    exit 1
fi

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "ℹ️  No services are currently running."
    exit 0
fi

# Stop services
echo "📦 Stopping containers..."
docker-compose down

echo "✅ Services stopped successfully!"

echo ""
echo "📝 To completely remove data volumes, run:"
echo "   docker-compose down -v"
echo ""
echo "⚠️  WARNING: This will delete all database data!" 