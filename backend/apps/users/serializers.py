from rest_framework import serializers
from .models import Address

class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ['id', 'name', 'phone_number', 'street_address', 'city', 
                 'state', 'pincode', 'latitude', 'longitude', 'address_type', 'is_default']