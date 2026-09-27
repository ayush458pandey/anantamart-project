#!/usr/bin/env bash
# =============================================================================
# ANANTAMART - Docker Entrypoint Script
# =============================================================================
# Handles: migrations, static files, superuser creation, server start
# =============================================================================

set -o errexit
set -o pipefail
set -o nounset

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.production}"
export DJANGO_SETTINGS_MODULE

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# -----------------------------------------------------------------------------
# Wait for Database
# -----------------------------------------------------------------------------
wait_for_db() {
    log "Waiting for database..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if python -c "
import os
import dj_database_url
try:
    config = dj_database_url.config(default=os.environ.get('DATABASE_URL'))
    import psycopg2
    conn = psycopg2.connect(**config)
    conn.close()
    print('Database connection successful')
except Exception as e:
    print(f'Database connection failed: {e}')
    exit(1)
" 2>/dev/null; then
            log "Database is ready!"
            return 0
        fi
        
        log "Database not ready (attempt $attempt/$max_attempts), waiting 2s..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error "Database not available after $max_attempts attempts"
    exit 1
}

# -----------------------------------------------------------------------------
# Wait for Redis (if configured)
# -----------------------------------------------------------------------------
wait_for_redis() {
    if [ -z "${REDIS_URL:-}" ]; then
        log "REDIS_URL not set, skipping Redis check"
        return 0
    fi
    
    log "Waiting for Redis..."
    
    local max_attempts=15
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if python -c "
import os
import redis
try:
    r = redis.from_url(os.environ.get('REDIS_URL'))
    r.ping()
    print('Redis connection successful')
except Exception as e:
    print(f'Redis connection failed: {e}')
    exit(1)
" 2>/dev/null; then
            log "Redis is ready!"
            return 0
        fi
        
        log "Redis not ready (attempt $attempt/$max_attempts), waiting 1s..."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    error "Redis not available after $max_attempts attempts"
    exit 1
}

# -----------------------------------------------------------------------------
# Run Migrations
# -----------------------------------------------------------------------------
run_migrations() {
    log "Running database migrations..."
    
    # First, fake the cart migrations to avoid constraint issues
    python manage.py migrate cart --fake || true
    
    # Run all migrations
    python manage.py migrate --noinput
    
    log "Migrations completed"
}

# -----------------------------------------------------------------------------
# Collect Static Files
# -----------------------------------------------------------------------------
collect_static() {
    log "Collecting static files..."
    python manage.py collectstatic --noinput --clear
    log "Static files collected"
}

# -----------------------------------------------------------------------------
# Create Superuser (if credentials provided)
# -----------------------------------------------------------------------------
create_superuser() {
    if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ] && [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
        log "Creating superuser..."
        python manage.py createsuperuser --noinput --username "${DJANGO_SUPERUSER_USERNAME}" --email "${DJANGO_SUPERUSER_EMAIL}" || true
        log "Superuser creation attempted"
    else
        log "Superuser credentials not provided, skipping"
    fi
}

# -----------------------------------------------------------------------------
# Validate Critical Settings
# -----------------------------------------------------------------------------
validate_settings() {
    log "Validating critical settings..."
    
    python -c "
import os
from django.conf import settings
settings.configure()
import django
django.setup()

# Check required settings
required = [
    'SECRET_KEY',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'EMAIL_HOST_USER',
    'EMAIL_HOST_PASSWORD',
    'GOOGLE_CLIENT_ID',
]

missing = []
for key in required:
    value = getattr(settings, key, None) or os.environ.get(key)
    if not value:
        missing.append(key)

if missing:
    print(f'Missing required settings: {missing}')
    exit(1)

print('All critical settings validated')
" || {
        error "Settings validation failed"
        exit 1
    }
    
    log "Settings validation passed"
}

# -----------------------------------------------------------------------------
# Main Execution
# -----------------------------------------------------------------------------
main() {
    log "Starting Anantamart Backend Entrypoint"
    log "Settings module: $DJANGO_SETTINGS_MODULE"
    
    # Wait for dependencies
    wait_for_db
    wait_for_redis
    
    # Validate settings (production only)
    if [ "$DJANGO_SETTINGS_MODULE" = "config.settings.production" ]; then
        validate_settings
    fi
    
    # Run migrations
    run_migrations
    
    # Collect static files
    collect_static
    
    # Create superuser if credentials provided
    create_superuser
    
    # Execute the main command
    log "Starting application: $*"
    exec "$@"
}

# Run main with all arguments
main "$@"