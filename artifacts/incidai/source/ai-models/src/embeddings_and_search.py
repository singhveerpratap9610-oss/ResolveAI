"""
Sentence Embeddings and Semantic Search
Generate embeddings and build FAISS index for similarity search
"""
import pandas as pd
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from configs.config import *
from typing import List, Tuple
import pickle

class EmbeddingPipeline:
    """Generate and manage sentence embeddings"""
    
    def __init__(self, model_name=None):
        self.model_name = model_name or EMBEDDING_MODEL
        self.model = None
        self.embeddings = None
        self.df = None
        
    def load_data(self):
        """Load cleaned ticket data"""
        print("Loading ticket data...")
        self.df = pd.read_csv(CLEAN_TICKETS_FILE)
        print(f"Loaded {len(self.df)} tickets")
        return self.df
    
    def load_model(self):
        """Load sentence transformer model"""
        print(f"\n=== Loading Embedding Model ===")
        print(f"Model: {self.model_name}")
        
        self.model = SentenceTransformer(self.model_name)
        print(f"✓ Model loaded")
        print(f"Embedding dimension: {self.model.get_sentence_embedding_dimension()}")
        
    def generate_embeddings(self, texts: List[str], batch_size=None):
        """Generate embeddings for texts"""
        batch_size = batch_size or EMBEDDING_BATCH_SIZE
        
        print(f"\n=== Generating Embeddings ===")
        print(f"Number of texts: {len(texts)}")
        print(f"Batch size: {batch_size}")
        
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=True,
            convert_to_numpy=True
        )
        
        print(f"✓ Embeddings generated")
        print(f"Shape: {embeddings.shape}")
        
        return embeddings
    
    def save_embeddings(self, embeddings):
        """Save embeddings to disk"""
        output_path = EMBEDDINGS_PATH
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        np.save(output_path, embeddings)
        print(f"✓ Saved embeddings to {output_path}")
        
        # Also save metadata
        metadata = {
            'model_name': self.model_name,
            'num_samples': len(embeddings),
            'embedding_dim': embeddings.shape[1],
            'shape': embeddings.shape
        }
        
        metadata_path = output_path.parent / "embeddings_metadata.pkl"
        with open(metadata_path, 'wb') as f:
            pickle.dump(metadata, f)
        
        print(f"✓ Saved metadata to {metadata_path}")
    
    def load_embeddings(self):
        """Load pre-computed embeddings"""
        if EMBEDDINGS_PATH.exists():
            print(f"Loading embeddings from {EMBEDDINGS_PATH}...")
            self.embeddings = np.load(EMBEDDINGS_PATH)
            print(f"✓ Loaded embeddings: {self.embeddings.shape}")
            return self.embeddings
        else:
            raise FileNotFoundError(f"Embeddings not found at {EMBEDDINGS_PATH}")
    
    def run_pipeline(self):
        """Run complete embedding generation pipeline"""
        print("=" * 50)
        print("SENTENCE EMBEDDINGS GENERATION PIPELINE")
        print("=" * 50)
        
        # Load data
        self.load_data()
        
        # Load model
        self.load_model()
        
        # Generate embeddings
        texts = self.df['clean_text'].tolist()
        embeddings = self.generate_embeddings(texts)
        
        # Save embeddings
        self.save_embeddings(embeddings)
        
        self.embeddings = embeddings
        
        print("\n" + "=" * 50)
        print("✓ EMBEDDING GENERATION COMPLETE")
        print("=" * 50)
        
        return embeddings

class SemanticSearchEngine:
    """Build and use FAISS index for semantic search"""
    
    def __init__(self):
        self.index = None
        self.embeddings = None
        self.df = None
        self.model = None
        
    def load_data(self):
        """Load ticket data and embeddings"""
        print("Loading data...")
        self.df = pd.read_csv(CLEAN_TICKETS_FILE)
        self.embeddings = np.load(EMBEDDINGS_PATH)
        print(f"✓ Loaded {len(self.df)} tickets and embeddings")
        
    def load_embedding_model(self):
        """Load embedding model for query encoding"""
        print(f"Loading embedding model: {EMBEDDING_MODEL}")
        self.model = SentenceTransformer(EMBEDDING_MODEL)
        print("✓ Model loaded")
        
    def build_index(self):
        """Build FAISS index"""
        print("\n=== Building FAISS Index ===")
        
        # Normalize embeddings for cosine similarity
        embeddings_normalized = self.embeddings / np.linalg.norm(
            self.embeddings, axis=1, keepdims=True
        )
        
        # Create index
        dimension = embeddings_normalized.shape[1]
        self.index = faiss.IndexFlatIP(dimension)  # Inner Product for cosine similarity
        
        # Add vectors to index
        self.index.add(embeddings_normalized.astype('float32'))
        
        print(f"✓ Built FAISS index")
        print(f"  Dimension: {dimension}")
        print(f"  Total vectors: {self.index.ntotal}")
        
        # Save index
        faiss.write_index(self.index, str(FAISS_INDEX_PATH))
        print(f"✓ Saved index to {FAISS_INDEX_PATH}")
    
    def load_index(self):
        """Load pre-built FAISS index"""
        if FAISS_INDEX_PATH.exists():
            print(f"Loading FAISS index from {FAISS_INDEX_PATH}...")
            self.index = faiss.read_index(str(FAISS_INDEX_PATH))
            print(f"✓ Loaded index with {self.index.ntotal} vectors")
            return self.index
        else:
            raise FileNotFoundError(f"Index not found at {FAISS_INDEX_PATH}")
    
    def search(self, query: str, k: int = 5) -> List[Tuple[int, float, dict]]:
        """
        Search for similar tickets
        
        Args:
            query: Search query text
            k: Number of results to return
            
        Returns:
            List of (index, similarity_score, ticket_data) tuples
        """
        # Encode query
        query_embedding = self.model.encode([query], convert_to_numpy=True)
        query_embedding = query_embedding / np.linalg.norm(query_embedding)
        
        # Search
        similarities, indices = self.index.search(
            query_embedding.astype('float32'), k
        )
        
        # Prepare results
        results = []
        for idx, similarity in zip(indices[0], similarities[0]):
            ticket = self.df.iloc[idx].to_dict()
            results.append((idx, float(similarity), ticket))
        
        return results
    
    def display_results(self, query: str, results: List[Tuple[int, float, dict]]):
        """Display search results"""
        print(f"\n{'='*70}")
        print(f"Query: {query}")
        print(f"{'='*70}\n")
        
        for i, (idx, similarity, ticket) in enumerate(results, 1):
            print(f"Result {i} (Similarity: {similarity:.4f})")
            print(f"  Category: {ticket.get(TARGET_COLUMN, 'N/A')}")
            print(f"  Title: {ticket.get('Title', 'N/A')[:100]}")
            print(f"  Description: {ticket.get('Description', 'N/A')[:150]}...")
            if 'Resolution Comments' in ticket and pd.notna(ticket['Resolution Comments']):
                print(f"  Resolution: {ticket['Resolution Comments'][:150]}...")
            print()
    
    def run_pipeline(self):
        """Run complete semantic search setup"""
        print("=" * 50)
        print("SEMANTIC SEARCH ENGINE SETUP")
        print("=" * 50)
        
        # Load data
        self.load_data()
        
        # Load model
        self.load_embedding_model()
        
        # Build index
        self.build_index()
        
        print("\n" + "=" * 50)
        print("✓ SEMANTIC SEARCH SETUP COMPLETE")
        print("=" * 50)
    
    def demo_search(self, queries: List[str] = None, k: int = 3):
        """Demo search with sample queries"""
        if queries is None:
            queries = [
                "need access to folder",
                "server is down and not responding",
                "backup failed last night",
                "oracle database connection error"
            ]
        
        print("\n" + "=" * 50)
        print("DEMO: SEMANTIC SEARCH")
        print("=" * 50)
        
        for query in queries:
            results = self.search(query, k=k)
            self.display_results(query, results)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['embeddings', 'search', 'both'], 
                       default='both', help='Pipeline mode')
    args = parser.parse_args()
    
    if args.mode in ['embeddings', 'both']:
        # Generate embeddings
        emb_pipeline = EmbeddingPipeline()
        emb_pipeline.run_pipeline()
    
    if args.mode in ['search', 'both']:
        # Build search engine
        search_engine = SemanticSearchEngine()
        search_engine.run_pipeline()
        
        # Demo search
        search_engine.demo_search()
