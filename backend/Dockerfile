# =============================================================================
# ANANTAMART - Multi-stage Dockerfile for Django Backend
# =============================================================================
# Build: docker build -t anantamart-backend .
# Run: docker run -p 8000:8000 --env-file .env anantamart-backend
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Base Python Image
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set work directory
WORKDIR /app

# -----------------------------------------------------------------------------
# STAGE 2: Dependencies Installation
# -----------------------------------------------------------------------------
FROM base AS dependencies

# Copy requirements first for better caching
COPY requirements/ ./requirements/
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements/production.txt

# -----------------------------------------------------------------------------
# STAGE 3: Application Build
# -----------------------------------------------------------------------------
FROM dependencies AS build

# Copy application code
COPY . .

# Collect static files (requires DATABASE_URL for migrations, but we skip migrate here)
# Static collection will happen at runtime in the entrypoint
# RUN python manage.py collectstatic --noinput --clear

# -----------------------------------------------------------------------------
# STAGE 4: Production Runtime
# -----------------------------------------------------------------------------
FROM base AS production

# Copy installed packages from dependencies stage
COPY --from=dependencies /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin

# Copy application code
COPY --from=build /app /app

# Create directories for static/media files
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health/', timeout=5)" || exit 1

# Entrypoint script handles migrations, static files, and server start
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command (can be overridden)
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"]

# -----------------------------------------------------------------------------
# STAGE 5: Development (Optional - for local development with hot reload)
# -----------------------------------------------------------------------------
FROM dependencies AS development

# Install development dependencies
RUN pip install -r requirements/development.txt

# Copy application code
COPY --from=build /app /app

# Create directories
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Development uses runserver with auto-reload
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]