#!/bin/bash
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=${BACKUP_DIR:-./backups}
CONTAINER=${DB_CONTAINER:-maxmarket_postgres}
DB_USER=${POSTGRES_USER:-maxmarket_user}
DB_NAME=${POSTGRES_DB:-maxmarket_db}

mkdir -p "$BACKUP_DIR"

echo "Backing up $DB_NAME from $CONTAINER..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/maxmarket_$TIMESTAMP.sql"

echo "Backup saved: $BACKUP_DIR/maxmarket_$TIMESTAMP.sql"
echo "Size: $(du -h "$BACKUP_DIR/maxmarket_$TIMESTAMP.sql" | cut -f1)"
