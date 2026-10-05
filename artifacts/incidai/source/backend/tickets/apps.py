"""
Tickets App Configuration
"""
from django.apps import AppConfig


class TicketsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tickets'
    
    def ready(self):
        """
        Import signals when app is ready
        """
        pass
