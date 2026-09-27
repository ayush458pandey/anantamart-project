"""
Custom permission classes for Anantamart.
"""
from rest_framework import permissions


class IsOwner(permissions.BasePermission):
    """
    Object-level permission: only allow access to objects owned by the requesting user.
    Assumes the model instance has a `user` attribute.
    """
    message = 'You do not have permission to access this object.'
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        # Superusers can access everything
        if request.user.is_staff:
            return True
        return getattr(obj, 'user_id', None) == request.user.id


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission: read access for anyone, write access only for owner.
    """
    message = 'You do not have permission to modify this object.'
    
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        return getattr(obj, 'user_id', None) == request.user.id


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Read access for anyone, write access only for staff/admin users.
    """
    message = 'Only administrators can modify this resource.'
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsVerifiedUser(permissions.BasePermission):
    """
    Only allow access to users with a verified email.
    Extend this if you add email verification.
    """
    message = 'Your account must be verified to access this resource.'
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Placeholder: implement email verification check
        # return request.user.profile.is_email_verified
        return True


class HasGSTNumber(permissions.BasePermission):
    """
    B2B permission: only allow access to users with a registered GST number.
    Useful for wholesale-only features.
    """
    message = 'A valid GST number is required for this action.'
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        profile = getattr(request.user, 'profile', None)
        return bool(profile and profile.gst_number)


class IsOrderOwner(permissions.BasePermission):
    """
    Object-level permission for orders: only the order owner or staff can access.
    """
    message = 'You do not have permission to access this order.'
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        return obj.user_id == request.user.id


class IsAddressOwner(permissions.BasePermission):
    """
    Object-level permission for addresses: only the address owner or staff can access.
    """
    message = 'You do not have permission to access this address.'
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        return obj.user_id == request.user.id