"""
Testing settings for Anantamart.
Optimized for fast test execution with minimal overhead.
"""
from .base import *  # noqa: F403,F401

# --- SECURITY ---
DEBUG = False
SECRET_KEY = 'django-insecure-test-key-not-for-production'

# --- ALLOWED HOSTS ---
ALLOWED_HOSTS = ['*']

# --- DATABASE (In-memory SQLite for speed) ---
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# --- PASSWORD HASHING (Fast hasher for tests) ---
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# --- CACHING (Local memory) ---
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'anantamart-test-cache',
    }
}

# --- EMAIL (In-memory backend) ---
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
DEFAULT_FROM_EMAIL = 'test@ananta-mart.in'

# --- STATIC FILES (No collection needed) ---
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'
MEDIA_ROOT = BASE_DIR / 'test_media'

# --- MEDIA (Local filesystem) ---
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

# --- CELERY (Eager mode) ---
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache://'

# --- REST FRAMEWORK (No throttling, no pagination) ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_PAGINATION_CLASS': None,
    'PAGE_SIZE': None,
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
}

# --- JWT (Short tokens for tests) ---
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=10),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
}

# --- LOGGING (Minimal) ---
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {
            'class': 'logging.NullHandler',
        },
    },
    'root': {
        'handlers': ['null'],
    },
    'loggers': {
        'django': {
            'handlers': ['null'],
            'propagate': False,
        },
    },
}

# --- RAZORPAY (Dummy values) ---
RAZORPAY_KEY_ID = 'rzp_test_dummy'
RAZORPAY_KEY_SECRET = 'dummy_secret'

# --- CLOUDINARY (Dummy values) ---
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': 'test_cloud',
    'API_KEY': 'test_key',
    'API_SECRET': 'test_secret',
}

# --- GOOGLE OAUTH ---
GOOGLE_CLIENT_ID = 'test_client_id'

# --- ADMIN EMAILS ---
ADMIN_EMAILS = ['test@ananta-mart.in']

# --- MIGRATIONS (Disable for faster tests) ---
class DisableMigrations:
    def __contains__(self, item):
        return True
    def __getitem__(self, item):
        return None

MIGRATION_MODULES = DisableMigrations()

# --- CORS (Allow all in tests) ---
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True