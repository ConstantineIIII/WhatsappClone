#!/bin/bash

# WhatsApp Clone Database Backup Script

set -e

# Configuration
BACKUP_DIR="./backups"
DB_NAME="whatsapp_clone"
DB_USER="whatsapp_user"
CONTAINER_NAME="whatsapp_clone_db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/whatsapp_clone_backup_$TIMESTAMP.sql"

echo "💾 Creating database backup..."

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Database container is not running. Please start the database first."
    exit 1
fi

# Create backup
echo "📦 Creating backup: $BACKUP_FILE"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully!"
    
    # Get file size
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📊 Backup size: $FILE_SIZE"
    
    # Optional: Compress the backup
    echo "🗜️  Compressing backup..."
    gzip "$BACKUP_FILE"
    COMPRESSED_FILE="$BACKUP_FILE.gz"
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    
    echo "✅ Backup compressed successfully!"
    echo "📊 Compressed size: $COMPRESSED_SIZE"
    echo "📁 Backup location: $COMPRESSED_FILE"
    
    # Clean up old backups (keep last 10)
    echo "🧹 Cleaning up old backups..."
    ls -t "$BACKUP_DIR"/whatsapp_clone_backup_*.sql.gz | tail -n +11 | xargs -r rm
    
    echo "🎉 Backup process completed!"
else
    echo "❌ Backup failed!"
    exit 1
fi 