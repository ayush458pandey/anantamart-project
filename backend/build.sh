#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Collect static files for WhiteNoise 
python manage.py collectstatic --no-input

# Apply any outstanding database migrations 
# First fake migration 0011 since has_variants column already exists in production
python manage.py migrate products 0011 --fake || true
python manage.py migrate

# Add this line to create the superuser automatically
python manage.py createsuperuser --noinput || true