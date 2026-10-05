"""
Django REST Framework Serializers

Converts Django models to JSON and vice versa for API responses
"""

from rest_framework import serializers
from tickets.models import Ticket, TicketCategory, TicketResolution, SimilarTicket


class TicketCategorySerializer(serializers.ModelSerializer):
    """Serializer for TicketCategory model"""
    
    class Meta:
        model = TicketCategory
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['created_at']


class SimilarTicketSerializer(serializers.ModelSerializer):
    """Serializer for Similar Tickets"""
    
    class Meta:
        model = SimilarTicket
        fields = [
            'id',
            'similar_ticket_id',
            'similarity_score',
            'similar_title',
            'similar_description',
            'similar_category',
            'created_at'
        ]
        read_only_fields = ['created_at']


class TicketResolutionSerializer(serializers.ModelSerializer):
    """Serializer for AI-generated ticket resolutions"""
    
    class Meta:
        model = TicketResolution
        fields = [
            'id',
            'resolution_text',
            'method',
            'similar_tickets_count',
            'is_helpful',
            'feedback_notes',
            'created_at'
        ]
        read_only_fields = ['created_at']


class TicketSerializer(serializers.ModelSerializer):
    """
    Main Ticket Serializer
    
    Includes nested resolutions and similar tickets
    """
    resolutions = TicketResolutionSerializer(many=True, read_only=True)
    similar_to = SimilarTicketSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Ticket
        fields = [
            'id',
            'title',
            'description',
            'predicted_category',
            'confidence_score',
            'category',
            'category_name',
            'priority',
            'status',
            'created_by',
            'assigned_to',
            'email',
            'phone',
            'created_at',
            'updated_at',
            'resolved_at',
            'resolutions',
            'similar_to'
        ]
        read_only_fields = [
            'predicted_category',
            'confidence_score',
            'created_at',
            'updated_at',
            'resolved_at'
        ]


class TicketCreateSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for creating tickets
    Only requires title and description
    """
    
    class Meta:
        model = Ticket
        fields = ['title', 'description', 'email', 'phone', 'priority']
        
    def create(self, validated_data):
        # Create ticket without AI prediction
        # AI prediction will be added by the view
        return Ticket.objects.create(**validated_data)


class PredictionRequestSerializer(serializers.Serializer):
    """
    Serializer for ML prediction requests
    """
    title = serializers.CharField(max_length=500)
    description = serializers.CharField()


class PredictionResponseSerializer(serializers.Serializer):
    """
    Serializer for ML prediction responses
    """
    category = serializers.CharField()
    confidence = serializers.FloatField()
    method = serializers.CharField()
    all_probabilities = serializers.DictField(child=serializers.FloatField(), required=False)


class SimilarTicketSearchSerializer(serializers.Serializer):
    """
    Serializer for semantic search results
    """
    similarity = serializers.FloatField()
    category = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()


class SemanticSearchResponseSerializer(serializers.Serializer):
    """
    Serializer for semantic search API response
    """
    query = serializers.CharField()
    results = SimilarTicketSearchSerializer(many=True)


class ResolutionRequestSerializer(serializers.Serializer):
    """
    Serializer for resolution generation requests
    """
    title = serializers.CharField(max_length=500)
    description = serializers.CharField()
    use_llm = serializers.BooleanField(default=False)


class ResolutionResponseSerializer(serializers.Serializer):
    """
    Serializer for resolution generation responses
    """
    predicted_category = serializers.CharField()
    resolution = serializers.CharField()
    similar_tickets_count = serializers.IntegerField()
    method = serializers.CharField()
    similar_tickets = SimilarTicketSearchSerializer(many=True, required=False)


class TicketAnalysisSerializer(serializers.Serializer):
    """
    Complete ticket analysis response
    """
    prediction = PredictionResponseSerializer()
    similar_tickets = SimilarTicketSearchSerializer(many=True)
    resolution = serializers.DictField()
