"""URL routes for the restricted AI API."""
from django.urls import path

from .views import AIDraftImageView, AIProductDraftView, AITaxonomyView

urlpatterns = [
    path('taxonomy/', AITaxonomyView.as_view(), name='taxonomy'),
    path('drafts/', AIProductDraftView.as_view(), name='drafts'),
    path('drafts/<int:pk>/images/', AIDraftImageView.as_view(), name='draft-images'),
]
