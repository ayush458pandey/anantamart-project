from django.urls import path
from . import views

from django.urls import path
from . import views  # 👈 This import is crucial!

urlpatterns = [
    # API: /api/cart/my_cart/
    path('cart/my_cart/', views.my_cart, name='my-cart'),

    # API: /api/cart/add/
    path('cart/add/', views.add_to_cart, name='add-to-cart'),

    # API: /api/cart/item/5/
    path('cart/item/<int:item_id>/', views.update_cart_item, name='update-cart-item'),

    # API: /api/cart/remove/5/
    path('cart/remove/<int:item_id>/', views.remove_from_cart, name='remove-from-cart'),

    # API: /api/cart/clear/
    path('cart/clear/', views.clear_cart, name='clear-cart'),
]