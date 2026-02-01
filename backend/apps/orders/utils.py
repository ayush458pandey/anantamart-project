from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_order_confirmation_email(order):
    """
    Sends an order confirmation email to the customer and admin using a simple HTML string construction.
    We avoid Django templates here for simplicity in this utility file, but templates are better long-term.
    """
    try:
        subject = f"Order Confirmation - {order.order_number}"
        
        # --- HTML EMAIL CONSTRUCTION ---
        # Build Item Rows
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

        html_content = f"""
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
        
        text_content = strip_tags(html_content)  # Fallback for email clients that don't support HTML
        
        # Recipients: Customer + Admins
        recipient_list = [order.user.email] if order.user.email else []
        bcc_list = getattr(settings, 'ADMIN_EMAILS', [])
        
        # Create Email
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=recipient_list,
            bcc=bcc_list
        )
        email.attach_alternative(html_content, "text/html")
        email.send(fail_silently=False)
        
        logger.info(f"Order confirmation email sent for Order #{order.order_number}")
        return True

    except Exception as e:
        logger.error(f"Failed to send order email: {str(e)}")
        # We don't want to fail the order process if email fails, so we just log it
        return False
