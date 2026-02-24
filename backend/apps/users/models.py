from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import re


class UserProfile(models.Model):
    """Extended profile for B2B customers"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    gst_number = models.CharField(max_length=15, blank=True, default='', help_text='GST Identification Number (GSTIN)')
    phone_number = models.CharField(max_length=15, blank=True, default='')
    business_name = models.CharField(max_length=200, blank=True, default='')

    def __str__(self):
        return f"{self.user.username}'s profile"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.gst_number:
            # GST format: 2 digits state code + 10 char PAN + 1 digit entity + Z + 1 check digit
            pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
            if not re.match(pattern, self.gst_number.upper()):
                raise ValidationError({'gst_number': 'Invalid GST number format'})

# Auto-create UserProfile when a User is created
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    try:
        instance.profile.save()
    except UserProfile.DoesNotExist:
        UserProfile.objects.create(user=instance)


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