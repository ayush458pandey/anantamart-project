from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status as http_status
from django.db.models import Sum, Count, Avg, F, Q, DecimalField, ExpressionWrapper
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
import traceback

from .models import Order, OrderItem
from apps.products.models import Product


@api_view(['GET'])
@permission_classes([IsAdminUser])
def dashboard_view(request):
    """
    Single aggregated endpoint for admin dashboard analytics.
    Returns all metrics in one JSON response.
    """
    try:
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
        daily_revenue_qs = (
            active_orders
            .filter(created_at__date__gte=week_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(revenue=Sum('total'), orders=Count('id'))
            .order_by('day')
        )
        # Convert to a dict for easy lookup
        daily_map = {}
        for entry in daily_revenue_qs:
            day_key = entry['day']
            if hasattr(day_key, 'date'):
                day_key = day_key.date()
            daily_map[day_key.isoformat()] = entry

        revenue_chart = []
        for i in range(7):
            day = week_ago + timedelta(days=i)
            key = day.isoformat()
            entry = daily_map.get(key)
            revenue_chart.append({
                'date': key,
                'revenue': float(entry['revenue']) if entry else 0,
                'orders': entry['orders'] if entry else 0,
            })

        # -------------- PROFIT TRACKING ----------------
        item_qs = OrderItem.objects.filter(order__in=active_orders)

        total_cost = item_qs.aggregate(
            cost=Sum(
                ExpressionWrapper(
                    F('price') * F('quantity'),
                    output_field=DecimalField(max_digits=12, decimal_places=2)
                )
            )
        )['cost'] or 0

        item_revenue = item_qs.aggregate(revenue=Sum('total'))['revenue'] or 0

        gross_margin = 0
        if float(item_revenue) > 0:
            gross_margin = ((float(item_revenue) - float(total_cost)) / float(item_revenue) * 100)

        # ----------- CATEGORY PERFORMANCE ---------------
        category_stats = list(
            item_qs
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
                'revenue': float(c['revenue'] or 0),
                'order_count': c['order_count'],
                'qty_sold': c['qty_sold'],
            }
            for c in category_stats
        ]

        # ------------- LOW STOCK ALERTS ----------------
        low_stock = list(
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
        top_buyers = list(
            active_orders
            .values(
                user_id=F('user__id'),
                username=F('user__username'),
                first_name=F('user__first_name'),
                last_name=F('user__last_name'),
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
                'business_name': '',
                'total_spend': float(b['total_spend'] or 0),
                'order_count': b['order_count'],
            }
            for b in top_buyers
        ]

        # Try to attach business names from profiles
        try:
            from apps.users.models import UserProfile
            profiles = {
                p.user_id: p.business_name
                for p in UserProfile.objects.filter(
                    user_id__in=[b['user_id'] for b in top_buyers]
                )
            }
            for buyer in top_buyers_list:
                buyer['business_name'] = profiles.get(buyer['user_id'], '')
        except Exception:
            pass

        # ------------ REFUND / CANCELLATION TRACKING ---------------
        all_orders_count = Order.objects.count()
        cancelled = Order.objects.filter(status='cancelled')
        cancelled_count = cancelled.count()
        cancelled_value = cancelled.aggregate(total=Sum('total'))['total'] or 0
        cancellation_rate = (cancelled_count / all_orders_count * 100) if all_orders_count > 0 else 0

        # ------------ ORDER STATUS BREAKDOWN ----------------
        status_breakdown = list(
            Order.objects
            .values('status')
            .annotate(count=Count('id'))
            .order_by('status')
        )
        order_statuses = {s['status']: s['count'] for s in status_breakdown}

        # Payment method breakdown
        payment_breakdown = list(
            active_orders
            .values('payment_method')
            .annotate(count=Count('id'), total=Sum('total'))
            .order_by('-total')
        )
        payment_methods = [
            {
                'method': p['payment_method'],
                'count': p['count'],
                'total': float(p['total'] or 0),
            }
            for p in payment_breakdown
        ]

        # ------------ DAILY HEALTH SCORE ---------------
        order_score = min(today_orders / 10 * 100, 100) if today_orders > 0 else 0
        revenue_score = min(float(today_revenue) / 50000 * 100, 100)
        cancel_score = max(100 - (cancellation_rate * 5), 0)

        total_products = Product.objects.filter(is_active=True).count()
        out_of_stock = Product.objects.filter(is_active=True, stock=0).count()
        stock_ratio = (out_of_stock / total_products) if total_products > 0 else 0
        stock_score = max(100 - (stock_ratio * 200), 0)

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

    except Exception as e:
        return Response(
            {'error': f'Dashboard computation failed: {str(e)}', 'trace': traceback.format_exc()},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )
