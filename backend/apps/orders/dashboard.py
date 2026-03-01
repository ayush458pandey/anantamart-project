from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.db.models import Sum, Count, Avg, F, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta

from .models import Order, OrderItem
from apps.products.models import Product, Category


@api_view(['GET'])
@permission_classes([IsAdminUser])
def dashboard_view(request):
    """
    Single aggregated endpoint for admin dashboard analytics.
    Returns all metrics in one JSON response.
    """
    now = timezone.now()
    today = now.date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # ----------------- SALES OVERVIEW -----------------
    active_orders = Order.objects.exclude(status='cancelled')

    total_revenue = active_orders.aggregate(total=Sum('total'))['total'] or 0
    total_orders = active_orders.count()
    avg_order_value = active_orders.aggregate(avg=Avg('total'))['avg'] or 0

    today_revenue = active_orders.filter(
        created_at__date=today
    ).aggregate(total=Sum('total'))['total'] or 0

    today_orders = active_orders.filter(created_at__date=today).count()

    week_revenue = active_orders.filter(
        created_at__date__gte=week_ago
    ).aggregate(total=Sum('total'))['total'] or 0

    month_revenue = active_orders.filter(
        created_at__date__gte=month_ago
    ).aggregate(total=Sum('total'))['total'] or 0

    # ------------- REVENUE CHART (Last 7 days) ---------------
    daily_revenue = (
        active_orders
        .filter(created_at__date__gte=week_ago)
        .annotate(date=TruncDate('created_at'))
        .values('date')
        .annotate(revenue=Sum('total'), orders=Count('id'))
        .order_by('date')
    )
    # Fill in missing days
    revenue_chart = []
    for i in range(7):
        day = week_ago + timedelta(days=i)
        entry = next((d for d in daily_revenue if d['date'] == day), None)
        revenue_chart.append({
            'date': day.isoformat(),
            'revenue': float(entry['revenue']) if entry else 0,
            'orders': entry['orders'] if entry else 0,
        })

    # -------------- PROFIT TRACKING ----------------
    # Revenue = sum of OrderItem.total for active orders
    # Cost approximation = sum of (Product.base_price * qty) — since base_price IS the cost to buyer,
    # we use the order-level subtotal vs total to show margin from taxes/delivery
    total_cost = OrderItem.objects.filter(
        order__in=active_orders
    ).aggregate(
        cost=Sum(F('price') * F('quantity'))
    )['cost'] or 0

    item_revenue = OrderItem.objects.filter(
        order__in=active_orders
    ).aggregate(revenue=Sum('total'))['revenue'] or 0

    gross_margin = ((float(item_revenue) - float(total_cost)) / float(item_revenue) * 100) if item_revenue > 0 else 0

    # ----------- CATEGORY PERFORMANCE ---------------
    category_stats = (
        OrderItem.objects
        .filter(order__in=active_orders)
        .values(
            category_name=F('product__category__name'),
            category_id=F('product__category__id'),
        )
        .annotate(
            revenue=Sum('total'),
            order_count=Count('order', distinct=True),
            qty_sold=Sum('quantity'),
        )
        .order_by('-revenue')[:5]
    )
    category_performance = [
        {
            'category_id': c['category_id'],
            'category_name': c['category_name'] or 'Uncategorized',
            'revenue': float(c['revenue']),
            'order_count': c['order_count'],
            'qty_sold': c['qty_sold'],
        }
        for c in category_stats
    ]

    # ------------- LOW STOCK ALERTS ----------------
    low_stock = (
        Product.objects
        .filter(is_active=True, stock__lte=10)
        .select_related('category')
        .order_by('stock')[:20]
    )
    low_stock_alerts = [
        {
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'stock': p.stock,
            'category': p.category.name if p.category else 'N/A',
            'severity': 'critical' if p.stock == 0 else ('warning' if p.stock <= 5 else 'low'),
        }
        for p in low_stock
    ]

    # -------------- TOP BUYERS -----------------
    top_buyers = (
        active_orders
        .values(
            user_id=F('user__id'),
            username=F('user__username'),
            first_name=F('user__first_name'),
            last_name=F('user__last_name'),
            business_name=F('user__profile__business_name'),
        )
        .annotate(
            total_spend=Sum('total'),
            order_count=Count('id'),
        )
        .order_by('-total_spend')[:10]
    )
    top_buyers_list = [
        {
            'user_id': b['user_id'],
            'name': f"{b['first_name'] or ''} {b['last_name'] or ''}".strip() or b['username'],
            'business_name': b['business_name'] or '',
            'total_spend': float(b['total_spend']),
            'order_count': b['order_count'],
        }
        for b in top_buyers
    ]

    # ------------ REFUND / CANCELLATION TRACKING ---------------
    all_orders_count = Order.objects.count()
    cancelled = Order.objects.filter(status='cancelled')
    cancelled_count = cancelled.count()
    cancelled_value = cancelled.aggregate(total=Sum('total'))['total'] or 0
    cancellation_rate = (cancelled_count / all_orders_count * 100) if all_orders_count > 0 else 0

    # ------------ ORDER STATUS BREAKDOWN ----------------
    status_breakdown = (
        Order.objects
        .values('status')
        .annotate(count=Count('id'))
        .order_by('status')
    )
    order_statuses = {s['status']: s['count'] for s in status_breakdown}

    # Payment method breakdown
    payment_breakdown = (
        active_orders
        .values('payment_method')
        .annotate(count=Count('id'), total=Sum('total'))
        .order_by('-total')
    )
    payment_methods = [
        {
            'method': p['payment_method'],
            'count': p['count'],
            'total': float(p['total']),
        }
        for p in payment_breakdown
    ]

    # ------------ DAILY HEALTH SCORE ---------------
    # Order score (0-100): 10+ orders today = 100
    order_score = min(today_orders / 10 * 100, 100) if today_orders > 0 else 0

    # Revenue score (0-100): ₹50,000+ today = 100
    revenue_score = min(float(today_revenue) / 50000 * 100, 100)

    # Cancellation score (0-100): 0% = 100, 20%+ = 0
    cancel_score = max(100 - (cancellation_rate * 5), 0)

    # Stock score (0-100): all in stock = 100, 50%+ out = 0
    total_products = Product.objects.filter(is_active=True).count()
    out_of_stock = Product.objects.filter(is_active=True, stock=0).count()
    stock_ratio = (out_of_stock / total_products) if total_products > 0 else 0
    stock_score = max(100 - (stock_ratio * 200), 0)  # 50% OOS = score 0

    health_score = round(
        (order_score * 0.3) +
        (revenue_score * 0.3) +
        (cancel_score * 0.2) +
        (stock_score * 0.2)
    )

    # ------------ ASSEMBLE RESPONSE ---------------
    return Response({
        'sales_overview': {
            'total_revenue': float(total_revenue),
            'total_orders': total_orders,
            'avg_order_value': round(float(avg_order_value), 2),
            'today_revenue': float(today_revenue),
            'today_orders': today_orders,
            'week_revenue': float(week_revenue),
            'month_revenue': float(month_revenue),
        },
        'revenue_chart': revenue_chart,
        'profit': {
            'total_revenue': float(item_revenue),
            'total_cost': float(total_cost),
            'gross_profit': float(item_revenue) - float(total_cost),
            'gross_margin_pct': round(gross_margin, 1),
        },
        'category_performance': category_performance,
        'low_stock_alerts': low_stock_alerts,
        'top_buyers': top_buyers_list,
        'refunds': {
            'cancelled_count': cancelled_count,
            'cancelled_value': float(cancelled_value),
            'cancellation_rate': round(cancellation_rate, 1),
        },
        'order_statuses': order_statuses,
        'payment_methods': payment_methods,
        'health_score': {
            'score': health_score,
            'breakdown': {
                'orders': round(order_score),
                'revenue': round(revenue_score),
                'cancellations': round(cancel_score),
                'stock': round(stock_score),
            }
        },
        'meta': {
            'total_products': total_products,
            'out_of_stock_products': out_of_stock,
            'total_users': Order.objects.values('user').distinct().count(),
        }
    })
