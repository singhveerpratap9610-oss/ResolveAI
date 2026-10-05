"""
FastAPI Deployment Server
REST API for ticket classification and resolution
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent / "src"))

import joblib
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss

from configs.config import *
from llm_rag import TicketResolutionRAG

# Initialize FastAPI app
app = FastAPI(
    title="ITSM Ticket Classification API",
    description="ML/DL powered ticket classification and resolution system",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
ml_model = None
tfidf_vectorizer = None
label_encoder = None
embedding_model = None
faiss_index = None
rag_system = None

# Request/Response models
class TicketInput(BaseModel):
    title: str
    description: str

class PredictionResponse(BaseModel):
    category: str
    confidence: float
    method: str

class SimilarTicket(BaseModel):
    similarity: float
    category: str
    title: str
    description: str

class SearchResponse(BaseModel):
    query: str
    results: List[SimilarTicket]

class ResolutionRequest(BaseModel):
    title: str
    description: str
    use_llm: bool = False

class ResolutionResponse(BaseModel):
    predicted_category: str
    resolution: str
    similar_tickets_count: int
    method: str

@app.on_event("startup")
async def load_models():
    """Load all models on startup"""
    global ml_model, tfidf_vectorizer, label_encoder
    global embedding_model, faiss_index, rag_system
    
    print("Loading models...")
    
    try:
        # Load ML model
        ml_model = joblib.load(BASELINE_MODEL_PATH)
        tfidf_vectorizer = joblib.load(TFIDF_PATH)
        label_encoder = joblib.load(LABEL_ENCODER_PATH)
        print("✓ ML model loaded")
    except Exception as e:
        print(f"Warning: Could not load ML model: {e}")
    
    try:
        # Load embedding model
        embedding_model = SentenceTransformer(EMBEDDING_MODEL)
        print("✓ Embedding model loaded")
    except Exception as e:
        print(f"Warning: Could not load embedding model: {e}")
    
    try:
        # Load FAISS index
        faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
        print("✓ FAISS index loaded")
    except Exception as e:
        print(f"Warning: Could not load FAISS index: {e}")
    
    try:
        # Initialize RAG system
        rag_system = TicketResolutionRAG()
        rag_system.setup()
        print("✓ RAG system loaded")
    except Exception as e:
        print(f"Warning: Could not load RAG system: {e}")
    
    print("Server ready!")

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "ITSM Ticket Classification API",
        "version": "1.0.0",
        "endpoints": {
            "predict_ml": "/predict/ml",
            "search": "/search",
            "resolve": "/resolve",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    status = {
        "ml_model": ml_model is not None,
        "embedding_model": embedding_model is not None,
        "faiss_index": faiss_index is not None,
        "rag_system": rag_system is not None
    }
    
    return {
        "status": "healthy" if all(status.values()) else "degraded",
        "models": status
    }

@app.post("/predict/ml", response_model=PredictionResponse)
async def predict_ml(ticket: TicketInput):
    """Predict ticket category using ML model"""
    if ml_model is None or tfidf_vectorizer is None:
        raise HTTPException(status_code=503, detail="ML model not loaded")
    
    try:
        # Combine and vectorize text
        text = f"{ticket.title} {ticket.description}"
        features = tfidf_vectorizer.transform([text])
        
        # Predict
        prediction = ml_model.predict(features)[0]
        probabilities = ml_model.predict_proba(features)[0]
        
        # Get category and confidence
        category = label_encoder.inverse_transform([prediction])[0]
        confidence = float(probabilities[prediction])
        
        return PredictionResponse(
            category=category,
            confidence=confidence,
            method="machine_learning"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search", response_model=SearchResponse)
async def semantic_search(ticket: TicketInput, k: int = 5):
    """Find similar tickets using semantic search"""
    if embedding_model is None or faiss_index is None:
        raise HTTPException(status_code=503, detail="Search system not loaded")
    
    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG system not loaded")
    
    try:
        # Search for similar tickets
        query = f"{ticket.title} {ticket.description}"
        results = rag_system.search_engine.search(query, k=k)
        
        # Format results
        similar_tickets = []
        for idx, similarity, ticket_data in results:
            similar_tickets.append(
                SimilarTicket(
                    similarity=float(similarity),
                    category=ticket_data.get(TARGET_COLUMN, "Unknown"),
                    title=ticket_data.get('Title', '')[:100],
                    description=ticket_data.get('Description', '')[:200]
                )
            )
        
        return SearchResponse(
            query=query,
            results=similar_tickets
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resolve", response_model=ResolutionResponse)
async def generate_resolution(request: ResolutionRequest):
    """Generate ticket resolution using RAG"""
    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG system not loaded")
    
    try:
        # Generate resolution
        result = rag_system.process_ticket(
            request.description,
            request.title,
            use_llm=request.use_llm,
            k_similar=5
        )
        
        return ResolutionResponse(
            predicted_category=result['predicted_category'],
            resolution=result['resolution'],
            similar_tickets_count=result['similar_tickets_count'],
            method=result['resolution_method']
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_ticket(ticket: TicketInput):
    """Complete analysis: prediction + similar tickets + resolution"""
    if None in [ml_model, rag_system]:
        raise HTTPException(status_code=503, detail="Required models not loaded")
    
    try:
        # Get ML prediction
        text = f"{ticket.title} {ticket.description}"
        features = tfidf_vectorizer.transform([text])
        prediction = ml_model.predict(features)[0]
        category = label_encoder.inverse_transform([prediction])[0]
        confidence = float(ml_model.predict_proba(features)[0][prediction])
        
        # Get similar tickets
        similar_results = rag_system.search_engine.search(text, k=3)
        
        # Generate resolution
        resolution_result = rag_system.process_ticket(
            ticket.description,
            ticket.title,
            use_llm=False
        )
        
        return {
            "prediction": {
                "category": category,
                "confidence": confidence
            },
            "similar_tickets": [
                {
                    "similarity": float(sim),
                    "category": t.get(TARGET_COLUMN, "Unknown")
                }
                for _, sim, t in similar_results
            ],
            "resolution": {
                "text": resolution_result['resolution'],
                "method": resolution_result['resolution_method']
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*70)
    print(" "*15 + "STARTING API SERVER")
    print("="*70)
    print(f"\nServer will be available at: http://{API_HOST}:{API_PORT}")
    print("\nAPI Documentation: http://localhost:8000/docs")
    print("\n" + "="*70 + "\n")
    
    uvicorn.run(
        app,
        host=API_HOST,
        port=API_PORT,
        log_level="info"
    )
