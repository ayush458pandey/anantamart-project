from django.db import models
from django.contrib.auth.models import User

class Address(models.Model):
    ADDRESS_TYPES = (
        ('home', 'Home'),
        ('office', 'Office'),
        ('warehouse', 'Warehouse'),
        ('other', 'Other'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    name = models.CharField(max_length=100, help_text="e.g. Main Warehouse")
    phone_number = models.CharField(max_length=15)
    street_address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    country = models.CharField(max_length=100, default='India')
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    address_type = models.CharField(max_length=20, choices=ADDRESS_TYPES, default='warehouse')
    is_default = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self.is_default:
            Address.objects.filter(user=self.user).update(is_default=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.city})"