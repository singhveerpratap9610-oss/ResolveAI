"""
AI Service Layer - ML Model Integration

This module handles:
- Loading trained ML/DL models
- Making predictions
- Semantic search using FAISS
- RAG-based resolution generation
"""

import os
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Dict, Tuple, Optional

from django.conf import settings
from sentence_transformers import SentenceTransformer
import faiss


class MLModelService:
    """
    Service for ML-based ticket classification
    
    Loads and uses the trained scikit-learn models for prediction
    """
    
    def __init__(self):
        self.model = None
        self.vectorizer = None
        self.label_encoder = None
        self.loaded = False
    
    def load_models(self):
        """Load ML models from disk"""
        try:
            self.model = joblib.load(settings.ML_MODEL_PATH)
            self.vectorizer = joblib.load(settings.TFIDF_PATH)
            self.label_encoder = joblib.load(settings.LABEL_ENCODER_PATH)
            self.loaded = True
            print("✓ ML models loaded successfully")
        except Exception as e:
            print(f"✗ Error loading ML models: {e}")
            self.loaded = False
    
    def predict(self, title: str, description: str) -> Dict:
        """
        Predict ticket category
        
        Args:
            title: Ticket title
            description: Ticket description
            
        Returns:
            Dictionary with category, confidence, and probabilities
        """
        if not self.loaded:
            raise Exception("ML models not loaded")
        
        # Combine text
        text = f"{title} {description}"
        
        # Vectorize
        features = self.vectorizer.transform([text])
        
        # Predict
        prediction = self.model.predict(features)[0]
        probabilities = self.model.predict_proba(features)[0]
        
        # Get category and confidence
        category = self.label_encoder.inverse_transform([prediction])[0]
        confidence = float(probabilities[prediction])
        
        # Get all class probabilities
        all_probs = {}
        for idx, prob in enumerate(probabilities):
            class_name = self.label_encoder.inverse_transform([idx])[0]
            all_probs[class_name] = float(prob)
        
        return {
            'category': category,
            'confidence': confidence,
            'method': 'machine_learning',
            'all_probabilities': all_probs
        }


class SemanticSearchService:
    """
    Service for semantic similarity search using sentence embeddings
    
    Uses Sentence-BERT and FAISS for fast vector search
    """
    
    def __init__(self):
        self.embedding_model = None
        self.faiss_index = None
        self.tickets_df = None
        self.loaded = False
    
    def load_models(self):
        """Load embedding model, FAISS index, and ticket data"""
        try:
            # Load sentence transformer model
            self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
            
            # Load FAISS index
            if settings.FAISS_INDEX_PATH.exists():
                self.faiss_index = faiss.read_index(str(settings.FAISS_INDEX_PATH))
            else:
                print("Warning: FAISS index not found, will create on demand")
            
            # Load processed tickets data
            if settings.PROCESSED_DATA_PATH.exists():
                self.tickets_df = pd.read_csv(settings.PROCESSED_DATA_PATH)
            else:
                print("Warning: Processed tickets data not found")
            
            self.loaded = True
            print("✓ Semantic search models loaded successfully")
        except Exception as e:
            print(f"✗ Error loading semantic search models: {e}")
            self.loaded = False
    
    def search(self, query: str, k: int = 5) -> List[Tuple]:
        """
        Search for similar tickets
        
        Args:
            query: Search query text
            k: Number of results to return
            
        Returns:
            List of tuples: (index, similarity_score, ticket_data)
        """
        if not self.loaded or self.faiss_index is None:
            raise Exception("Semantic search not available")
        
        # Generate query embedding
        query_embedding = self.embedding_model.encode([query])
        query_embedding = query_embedding.astype('float32')
        
        # Normalize for cosine similarity
        faiss.normalize_L2(query_embedding)
        
        # Search FAISS index
        distances, indices = self.faiss_index.search(query_embedding, k)
        
        # Format results
        results = []
        for i, (dist, idx) in enumerate(zip(distances[0], indices[0])):
            if idx < len(self.tickets_df):
                ticket_data = self.tickets_df.iloc[idx].to_dict()
                similarity = float(dist)  # Already cosine similarity due to normalization
                results.append((int(idx), similarity, ticket_data))
        
        return results


class RAGService:
    """
    Retrieval-Augmented Generation Service
    
    Generates ticket resolutions using similar tickets (RAG approach)
    """
    
    def __init__(self):
        self.ml_service = None
        self.search_service = None
        self.openai_available = bool(settings.OPENAI_API_KEY)
    
    def setup(self, ml_service: MLModelService, search_service: SemanticSearchService):
        """Setup RAG service with required dependencies"""
        self.ml_service = ml_service
        self.search_service = search_service
    
    def generate_resolution(
        self,
        title: str,
        description: str,
        use_llm: bool = False,
        k_similar: int = 5
    ) -> Dict:
        """
        Generate ticket resolution
        
        Args:
            title: Ticket title
            description: Ticket description
            use_llm: Whether to use OpenAI LLM
            k_similar: Number of similar tickets to retrieve
            
        Returns:
            Dictionary with resolution and metadata
        """
        # Get predicted category
        prediction = self.ml_service.predict(title, description)
        predicted_category = prediction['category']
        
        # Search for similar tickets
        query = f"{title} {description}"
        similar_tickets = self.search_service.search(query, k=k_similar)
        
        # Generate resolution based on similar tickets
        if use_llm and self.openai_available:
            resolution = self._generate_llm_resolution(
                title, description, predicted_category, similar_tickets
            )
            method = 'llm'
        else:
            resolution = self._generate_rule_based_resolution(
                title, description, predicted_category, similar_tickets
            )
            method = 'rule_based'
        
        return {
            'predicted_category': predicted_category,
            'resolution': resolution,
            'similar_tickets_count': len(similar_tickets),
            'method': method,
            'similar_tickets': [
                {
                    'similarity': sim,
                    'category': ticket.get('Service Category', 'Unknown'),
                    'title': ticket.get('Title', '')[:100],
                    'description': ticket.get('Description', '')[:200]
                }
                for idx, sim, ticket in similar_tickets
            ]
        }
    
    def _generate_rule_based_resolution(
        self,
        title: str,
        description: str,
        category: str,
        similar_tickets: List[Tuple]
    ) -> str:
        """Generate resolution using rule-based approach"""
        
        resolution = f"**Ticket Category:** {category}\n\n"
        resolution += "**Recommended Resolution Steps:**\n\n"
        
        # Add category-specific guidance
        category_guidance = {
            'Password Reset': "1. Verify user identity\n2. Use password reset tool\n3. Send temporary password\n4. Instruct user to change password on first login",
            'Folder Access': "1. Verify user permissions\n2. Check folder security settings\n3. Add user to appropriate security group\n4. Test access and confirm",
            'Slow Computer': "1. Check CPU and memory usage\n2. Clear temporary files\n3. Run antivirus scan\n4. Update drivers if needed\n5. Consider hardware upgrade if issue persists",
            'VPN Issues': "1. Verify VPN client version\n2. Check network connectivity\n3. Restart VPN service\n4. Verify credentials\n5. Check firewall settings",
            'Email Issues': "1. Check email server status\n2. Verify account credentials\n3. Check quota limits\n4. Test with webmail\n5. Reconfigure email client if needed",
        }
        
        if category in category_guidance:
            resolution += category_guidance[category]
        else:
            resolution += "1. Gather detailed information about the issue\n"
            resolution += "2. Check system logs for errors\n"
            resolution += "3. Apply relevant troubleshooting steps\n"
            resolution += "4. Test and verify resolution\n"
            resolution += "5. Document the solution"
        
        # Add similar tickets context
        if similar_tickets:
            resolution += "\n\n**Similar Resolved Tickets:**\n\n"
            for i, (idx, sim, ticket) in enumerate(similar_tickets[:3], 1):
                resolution += f"{i}. *{ticket.get('Title', 'N/A')[:80]}...* "
                resolution += f"(Similarity: {sim:.1%})\n"
        
        return resolution
    
    def _generate_llm_resolution(
        self,
        title: str,
        description: str,
        category: str,
        similar_tickets: List[Tuple]
    ) -> str:
        """Generate resolution using OpenAI LLM"""
        # This would call OpenAI API with proper context
        # For now, falls back to rule-based
        return self._generate_rule_based_resolution(title, description, category, similar_tickets)


# Global instances (loaded once at startup)
ml_service = MLModelService()
search_service = SemanticSearchService()
rag_service = RAGService()


def initialize_ai_services():
    """
    Initialize all AI services
    Called at Django startup
    """
    print("\n" + "="*70)
    print("Initializing AI Services...")
    print("="*70)
    
    ml_service.load_models()
    search_service.load_models()
    rag_service.setup(ml_service, search_service)
    
    print("="*70)
    print("AI Services Ready!")
    print("="*70 + "\n")
