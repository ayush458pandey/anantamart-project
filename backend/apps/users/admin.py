from django.contrib import admin
from .models import Address

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'city', 'pincode', 'address_type', 'is_default']
    list_filter = ['address_type', 'city']