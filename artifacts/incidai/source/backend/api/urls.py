"""
API URL Configuration

Defines all API endpoints and routes
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router for ViewSets
router = DefaultRouter()
router.register(r'tickets', views.TicketViewSet, basename='ticket')
router.register(r'categories', views.TicketCategoryViewSet, basename='category')

urlpatterns = [
    # Health check
    path('health/', views.health_check, name='health-check'),
    
    # ML prediction endpoints
    path('predict/', views.predict_category, name='predict'),
    path('search/', views.semantic_search, name='search'),
    path('resolve/', views.generate_resolution, name='resolve'),
    path('analyze/', views.analyze_ticket, name='analyze'),
    
    # Dashboard statistics
    path('stats/', views.dashboard_stats, name='stats'),
    
    # Include router URLs (tickets, categories)
    path('', include(router.urls)),
]
