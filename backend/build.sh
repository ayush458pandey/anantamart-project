#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Collect static files for WhiteNoise 
python manage.py collectstatic --no-input

# Apply any outstanding database migrations 
# Handle existing columns by faking specific migrations
python manage.py migrate products 0011 --fake || true
python manage.py migrate products 0012 --fake || true
python manage.py migrate products 0013 --fake || true
# Fake cart migrations to avoid constraint sync issues
python manage.py migrate cart --fake || true
python manage.py migrate

# Add this line to create the superuser automatically
python manage.py createsuperuser --noinput || true