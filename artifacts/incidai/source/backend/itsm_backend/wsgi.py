"""
WSGI config for itsm_backend project.

This module contains the WSGI application used by Django's development server
and any production WSGI deployments. It exposes the WSGI callable as a
module-level variable named ``application``.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'itsm_backend.settings')

application = get_wsgi_application()
