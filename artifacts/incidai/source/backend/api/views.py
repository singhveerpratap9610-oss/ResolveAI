"""
API Views - REST API Endpoints

This module provides all API endpoints for:
- Ticket CRUD operations
- ML predictions
- Semantic search
- Resolution generation
- Complete ticket analysis
"""

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiParameter

from tickets.models import Ticket, TicketCategory, TicketResolution, SimilarTicket
from .serializers import (
    TicketSerializer,
    TicketCreateSerializer,
    TicketCategorySerializer,
    PredictionRequestSerializer,
    PredictionResponseSerializer,
    SemanticSearchResponseSerializer,
    ResolutionRequestSerializer,
    ResolutionResponseSerializer,
    TicketAnalysisSerializer,
)
from .ai_service import ml_service, search_service, rag_service


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Ticket CRUD operations
    
    Provides:
    - list: GET /api/tickets/
    - create: POST /api/tickets/
    - retrieve: GET /api/tickets/{id}/
    - update: PUT /api/tickets/{id}/
    - partial_update: PATCH /api/tickets/{id}/
    - destroy: DELETE /api/tickets/{id}/
    """
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    pagination_class = StandardResultsSetPagination
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TicketCreateSerializer
        return TicketSerializer
    
    @extend_schema(
        summary="Create a new ticket with AI classification",
        description="Creates a ticket and automatically classifies it using ML models"
    )
    def create(self, request, *args, **kwargs):
        """
        Create a new ticket with automatic AI classification
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Create ticket
        ticket = serializer.save()
        
        # Add AI prediction
        try:
            if ml_service.loaded:
                prediction = ml_service.predict(ticket.title, ticket.description)
                ticket.predicted_category = prediction['category']
                ticket.confidence_score = prediction['confidence']
                ticket.save()
        except Exception as e:
            print(f"Error in AI prediction: {e}")
        
        # Return full ticket data
        response_serializer = TicketSerializer(ticket)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Generate resolution for a ticket",
        request=ResolutionRequestSerializer,
        responses={200: ResolutionResponseSerializer}
    )
    def generate_resolution(self, request, pk=None):
        """
        Generate AI-powered resolution for a specific ticket
        """
        ticket = self.get_object()
        
        use_llm = request.data.get('use_llm', False)
        
        try:
            # Generate resolution using RAG
            result = rag_service.generate_resolution(
                ticket.title,
                ticket.description,
                use_llm=use_llm
            )
            
            # Save resolution to database
            resolution = TicketResolution.objects.create(
                ticket=ticket,
                resolution_text=result['resolution'],
                method=result['method'],
                similar_tickets_count=result['similar_tickets_count']
            )
            
            # Save similar tickets
            for similar in result.get('similar_tickets', []):
                SimilarTicket.objects.create(
                    ticket=ticket,
                    similar_ticket_id=0,  # Would map to actual ID from dataset
                    similarity_score=similar['similarity'],
                    similar_title=similar['title'],
                    similar_description=similar['description'],
                    similar_category=similar['category']
                )
            
            return Response(result)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TicketCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing ticket categories
    """
    queryset = TicketCategory.objects.all()
    serializer_class = TicketCategorySerializer


@api_view(['GET'])
@extend_schema(
    summary="Health check endpoint",
    description="Check if API and AI services are running"
)
def health_check(request):
    """
    Check API and model health
    """
    status_info = {
        'api': 'healthy',
        'ml_model': ml_service.loaded,
        'semantic_search': search_service.loaded,
        'rag_service': rag_service.ml_service is not None,
    }
    
    return Response({
        'status': 'healthy' if all(status_info.values()) else 'degraded',
        'services': status_info
    })


@api_view(['POST'])
@extend_schema(
    summary="Predict ticket category",
    description="Classify a ticket using ML models",
    request=PredictionRequestSerializer,
    responses={200: PredictionResponseSerializer}
)
def predict_category(request):
    """
    Predict ticket category using ML model
    
    POST /api/predict/
    Body: {"title": "...", "description": "..."}
    """
    serializer = PredictionRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    if not ml_service.loaded:
        return Response(
            {'error': 'ML model not loaded'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
    try:
        result = ml_service.predict(
            serializer.validated_data['title'],
            serializer.validated_data['description']
        )
        return Response(result)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@extend_schema(
    summary="Search for similar tickets",
    description="Find similar tickets using semantic search",
    request=PredictionRequestSerializer,
    responses={200: SemanticSearchResponseSerializer},
    parameters=[
        OpenApiParameter(
            name='k',
            type=int,
            location=OpenApiParameter.QUERY,
            description='Number of results to return',
            default=5
        )
    ]
)
def semantic_search(request):
    """
    Search for similar tickets using semantic search
    
    POST /api/search/?k=5
    Body: {"title": "...", "description": "..."}
    """
    serializer = PredictionRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    if not search_service.loaded:
        return Response(
            {'error': 'Semantic search not available'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
    k = int(request.query_params.get('k', 5))
    
    try:
        query = f"{serializer.validated_data['title']} {serializer.validated_data['description']}"
        results = search_service.search(query, k=k)
        
        # Format results
        similar_tickets = []
        for idx, similarity, ticket_data in results:
            similar_tickets.append({
                'similarity': similarity,
                'category': ticket_data.get('Service Category', 'Unknown'),
                'title': ticket_data.get('Title', '')[:100],
                'description': ticket_data.get('Description', '')[:200]
            })
        
        return Response({
            'query': query,
            'results': similar_tickets
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@extend_schema(
    summary="Generate resolution for a ticket",
    description="Generate AI-powered resolution using RAG",
    request=ResolutionRequestSerializer,
    responses={200: ResolutionResponseSerializer}
)
def generate_resolution(request):
    """
    Generate ticket resolution using RAG
    
    POST /api/resolve/
    Body: {"title": "...", "description": "...", "use_llm": false}
    """
    serializer = ResolutionRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    if not (ml_service.loaded and search_service.loaded):
        return Response(
            {'error': 'AI services not available'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
    try:
        result = rag_service.generate_resolution(
            serializer.validated_data['title'],
            serializer.validated_data['description'],
            use_llm=serializer.validated_data.get('use_llm', False)
        )
        return Response(result)
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@extend_schema(
    summary="Complete ticket analysis",
    description="Get prediction + similar tickets + resolution in one call",
    request=PredictionRequestSerializer,
    responses={200: TicketAnalysisSerializer}
)
def analyze_ticket(request):
    """
    Complete ticket analysis: prediction + search + resolution
    
    POST /api/analyze/
    Body: {"title": "...", "description": "..."}
    """
    serializer = PredictionRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    if not (ml_service.loaded and search_service.loaded):
        return Response(
            {'error': 'AI services not available'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
    try:
        title = serializer.validated_data['title']
        description = serializer.validated_data['description']
        
        # Get prediction
        prediction = ml_service.predict(title, description)
        
        # Get similar tickets
        query = f"{title} {description}"
        similar_results = search_service.search(query, k=5)
        similar_tickets = [
            {
                'similarity': sim,
                'category': ticket.get('Service Category', 'Unknown'),
                'title': ticket.get('Title', '')[:100],
                'description': ticket.get('Description', '')[:200]
            }
            for idx, sim, ticket in similar_results
        ]
        
        # Generate resolution
        resolution_result = rag_service.generate_resolution(title, description, use_llm=False)
        
        return Response({
            'prediction': prediction,
            'similar_tickets': similar_tickets,
            'resolution': {
                'text': resolution_result['resolution'],
                'method': resolution_result['method']
            }
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@extend_schema(
    summary="Get dashboard statistics",
    description="Get ticket statistics for dashboard display"
)
def dashboard_stats(request):
    """
    Get statistics for dashboard
    """
    from django.db.models import Count, Q
    from datetime import datetime, timedelta
    
    # Total tickets
    total_tickets = Ticket.objects.count()
    
    # Tickets by status
    status_counts = dict(
        Ticket.objects.values('status').annotate(count=Count('id')).values_list('status', 'count')
    )
    
    # Tickets by priority
    priority_counts = dict(
        Ticket.objects.values('priority').annotate(count=Count('id')).values_list('priority', 'count')
    )
    
    # Top categories
    category_counts = list(
        Ticket.objects.values('predicted_category')
        .annotate(count=Count('id'))
        .order_by('-count')[:10]
    )
    
    # Recent tickets (last 7 days)
    week_ago = datetime.now() - timedelta(days=7)
    recent_count = Ticket.objects.filter(created_at__gte=week_ago).count()
    
    # Average confidence score
    from django.db.models import Avg
    avg_confidence = Ticket.objects.filter(
        confidence_score__isnull=False
    ).aggregate(Avg('confidence_score'))['confidence_score__avg'] or 0
    
    return Response({
        'total_tickets': total_tickets,
        'status_distribution': status_counts,
        'priority_distribution': priority_counts,
        'top_categories': category_counts,
        'recent_tickets_7d': recent_count,
        'average_confidence': round(avg_confidence, 3)
    })
