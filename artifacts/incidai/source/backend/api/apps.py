"""
API App Configuration
"""
from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    
    def ready(self):
        """
        Initialize AI services when Django starts
        """
        from .ai_service import initialize_ai_services
        try:
            initialize_ai_services()
        except Exception as e:
            print(f"Warning: Could not initialize AI services: {e}")
