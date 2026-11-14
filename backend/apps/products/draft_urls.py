"""URL routes for the staff-only AI draft review API."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .draft_views import ProductDraftViewSet

router = DefaultRouter()
router.register(r'drafts', ProductDraftViewSet, basename='product-draft')

urlpatterns = [
    path('', include(router.urls)),
]
