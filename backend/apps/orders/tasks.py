"""
Celery tasks for the orders app.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def send_order_confirmation_email_task(self, order_id):
    """
    Send order confirmation email asynchronously via Celery.

    Args:
        order_id: The ID of the order to send confirmation for
    """
    from .models import Order
    from .utils import _build_and_send_order_email

    try:
        order = Order.objects.prefetch_related('items__product').get(id=order_id)
    except Order.DoesNotExist:
        logger.error("Order %s not found for email confirmation", order_id)
        return f"Order {order_id} not found"

    try:
        _build_and_send_order_email(order)
        logger.info("Order confirmation email sent for order %s", order.order_number)
        return f"Email sent for order {order.order_number}"
    except Exception as exc:
        logger.error("Failed to send order email for %s: %s", order.order_number, exc)
        raise self.retry(exc=exc)