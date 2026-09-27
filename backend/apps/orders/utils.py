"""
Order utilities - email building and sending.
"""
import logging
import os
import threading

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _build_order_email_html(order):
    """Build the HTML body for an order confirmation email."""
    items_html = ""
    for item in order.items.all():
        items_html += f"""
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">{item.product.name}</td>
            <td style="padding: 10px; text-align: center;">{item.quantity}</td>
            <td style="padding: 10px; text-align: right;">₹{item.price}</td>
            <td style="padding: 10px; text-align: right;">₹{item.total}</td>
        </tr>
        """

    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #10b981; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0;">Order Confirmed!</h1>
                <p style="margin: 5px 0 0;">Thank you for shopping with Anantamart</p>
            </div>

            <div style="padding: 20px;">
                <p>Hi <strong>{order.user.get_full_name() or order.user.username}</strong>,</p>
                <p>Your order has been successfully placed. We will notify you once it's shipped.</p>

                <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold;">Order ID: {order.order_number}</p>
                    <p style="margin: 5px 0 0; color: #666;">Date: {order.created_at.strftime('%d %b, %Y')}</p>
                    <p style="margin: 5px 0 0; color: #666;">Payment: {order.get_payment_method_display()}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 10px; text-align: left;">Product</th>
                            <th style="padding: 10px; text-align: center;">Qty</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                            <th style="padding: 10px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right; border-top: 2px solid #eee;"><strong>Subtotal:</strong></td>
                            <td style="padding: 10px; text-align: right; border-top: 2px solid #eee;">₹{order.subtotal}</td>
                        </tr>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right;">Tax (GST):</td>
                            <td style="padding: 10px; text-align: right;">₹{order.cgst + order.sgst}</td>
                        </tr>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right; font-size: 1.1em; color: #10b981;"><strong>Grand Total:</strong></td>
                            <td style="padding: 10px; text-align: right; font-size: 1.1em; color: #10b981;"><strong>₹{order.total}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
                    <h3 style="margin-top: 0;">Delivery Address</h3>
                    <p style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                        {order.delivery_address}
                    </p>
                </div>
            </div>

            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                <p>&copy; 2024 Anantamart. All rights reserved.</p>
                <p>Need help? Contact us using the app.</p>
            </div>
        </div>
    </body>
    </html>
    """


def _get_recipients(order):
    """Build the recipient list for an order email."""
    admin_email = getattr(settings, 'ADMIN_EMAILS', ['ayush458pandey@gmail.com'])[0]
    recipients = [admin_email]
    if order.user.email and order.user.email != admin_email:
        recipients.append(order.user.email)
    return recipients


def _send_via_resend(subject, html_body, recipients, order_number):
    """Send email via Resend API. Raises on failure."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not set in environment variables")

    payload = {
        "from": "Anantamart <onboarding@resend.dev>",
        "to": recipients,
        "subject": subject,
        "html": html_body,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        "https://api.resend.com/emails", json=payload, headers=headers, timeout=15
    )

    if response.status_code not in (200, 201):
        raise RuntimeError(
            f"Resend API failed with status {response.status_code}: {response.text}"
        )

    logger.info("Order confirmation email sent for Order #%s", order_number)


def _build_and_send_order_email(order):
    """
    Build and send the order confirmation email synchronously.
    Used by the Celery task (and as a threading fallback).
    """
    if not settings.EMAIL_HOST_USER and not os.environ.get("RESEND_API_KEY"):
        logger.warning("No email credentials configured. Skipping email.")
        return

    subject = f"Order Confirmation - {order.order_number}"
    html_content = _build_order_email_html(order)
    recipients = _get_recipients(order)
    _send_via_resend(subject, html_content, recipients, order.order_number)


def send_order_confirmation_email(order):
    """
    Dispatch the order confirmation email.

    Prefers Celery (reliable, retried). Falls back to a daemon thread
    when Celery is unavailable (e.g. local dev without a worker).
    """
    try:
        from .tasks import send_order_confirmation_email_task

        send_order_confirmation_email_task.delay(order.id)
        return True
    except Exception as exc:
        logger.warning(
            "Celery dispatch failed (%s); falling back to background thread", exc
        )

    # Fallback: background thread (best-effort)
    def _run():
        try:
            _build_and_send_order_email(order)
        except Exception as e:
            logger.error("Failed to send order email: %s", e)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return True