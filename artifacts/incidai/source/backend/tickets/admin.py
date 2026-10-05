"""
Django Admin Configuration for Tickets

This file customizes the Django admin interface for:
- Viewing and managing tickets
- Viewing categories
- Viewing resolutions
"""

from django.contrib import admin
from .models import Ticket, TicketCategory, TicketResolution, SimilarTicket


@admin.register(TicketCategory)
class TicketCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['name']


class TicketResolutionInline(admin.TabularInline):
    model = TicketResolution
    extra = 0
    readonly_fields = ['created_at', 'method', 'similar_tickets_count']
    fields = ['resolution_text', 'method', 'similar_tickets_count', 'is_helpful', 'created_at']


class SimilarTicketInline(admin.TabularInline):
    model = SimilarTicket
    extra = 0
    readonly_fields = ['similarity_score', 'similar_title', 'created_at']
    fields = ['similarity_score', 'similar_title', 'similar_category']


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'title_short',
        'predicted_category',
        'priority',
        'status',
        'confidence_score',
        'created_at'
    ]
    list_filter = ['status', 'priority', 'predicted_category', 'created_at']
    search_fields = ['title', 'description', 'predicted_category']
    readonly_fields = ['predicted_category', 'confidence_score', 'created_at', 'updated_at', 'resolved_at']
    
    fieldsets = (
        ('Ticket Information', {
            'fields': ('title', 'description', 'email', 'phone')
        }),
        ('AI Classification', {
            'fields': ('predicted_category', 'confidence_score'),
            'classes': ('collapse',)
        }),
        ('Manual Assignment', {
            'fields': ('category', 'priority', 'status', 'assigned_to')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'resolved_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [TicketResolutionInline, SimilarTicketInline]
    
    def title_short(self, obj):
        return obj.title[:50] + ('...' if len(obj.title) > 50 else '')
    title_short.short_description = 'Title'


@admin.register(TicketResolution)
class TicketResolutionAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'method', 'similar_tickets_count', 'is_helpful', 'created_at']
    list_filter = ['method', 'is_helpful', 'created_at']
    search_fields = ['ticket__title', 'resolution_text']
    readonly_fields = ['created_at']


@admin.register(SimilarTicket)
class SimilarTicketAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'similarity_score', 'similar_category', 'created_at']
    list_filter = ['similar_category', 'created_at']
    search_fields = ['ticket__title', 'similar_title']
    readonly_fields = ['created_at']
    ordering = ['-similarity_score']
