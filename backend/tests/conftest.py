"""Shared fixtures for the AnantaMart backend test suite."""
import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def isolated_media_and_cache(tmp_path, settings):
    """Keep uploaded test images out of the repo and reset the page cache.

    ProductViewSet.list is wrapped in cache_page(300); without clearing the
    locmem cache between tests a cached response can leak across test cases.
    """
    settings.MEDIA_ROOT = str(tmp_path / 'media')
    cache.clear()
    yield
    cache.clear()
