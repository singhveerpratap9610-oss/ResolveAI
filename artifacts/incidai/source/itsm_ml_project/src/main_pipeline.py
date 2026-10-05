"""
Main Pipeline Orchestrator
Runs the complete ML/DL/LLM pipeline in sequence
"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from data_preprocessing import DataCleaner, split_dataset
from train_ml_models import BaselineMLPipeline
from embeddings_and_search import EmbeddingPipeline, SemanticSearchEngine
from llm_rag import TicketResolutionRAG

import argparse
import time

class ITSMPipeline:
    """Complete ITSM ML/DL/LLM Pipeline"""
    
    def __init__(self):
        self.start_time = None
        self.timings = {}
        
    def run_step(self, step_name: str, func, *args, **kwargs):
        """Run a pipeline step with timing"""
        print(f"\n{'='*70}")
        print(f"STEP: {step_name}")
        print(f"{'='*70}\n")
        
        step_start = time.time()
        result = func(*args, **kwargs)
        step_time = time.time() - step_start
        
        self.timings[step_name] = step_time
        print(f"\n✓ {step_name} completed in {step_time:.2f}s")
        
        return result
    
    def run_full_pipeline(
        self,
        skip_data_prep: bool = False,
        skip_ml: bool = False,
        skip_embeddings: bool = False,
        skip_dl: bool = False,
        run_rag_demo: bool = True
    ):
        """Run the complete pipeline"""
        self.start_time = time.time()
        
        print("\n" + "="*70)
        print(" "*15 + "ITSM TICKET CLASSIFICATION")
        print(" "*12 + "COMPLETE ML/DL/LLM PIPELINE")
        print("="*70)
        
        # Step 1: Data Preparation
        if not skip_data_prep:
            self.run_step(
                "1. Data Cleaning & Preprocessing",
                self._run_data_prep
            )
        
        # Step 2: ML Models
        if not skip_ml:
            self.run_step(
                "2. Baseline ML Models Training",
                self._run_ml_training
            )
        
        # Step 3: Embeddings
        if not skip_embeddings:
            self.run_step(
                "3. Sentence Embeddings Generation",
                self._run_embeddings
            )
            
            self.run_step(
                "4. Semantic Search Index Building",
                self._run_search_index
            )
        
        # Step 4: Deep Learning (Optional - can be slow)
        if not skip_dl:
            print("\n" + "="*70)
            print("NOTE: Deep Learning training can take 30+ minutes")
            print("Skipping DL training. Run separately with --dl flag")
            print("="*70)
        
        # Step 5: RAG Demo
        if run_rag_demo:
            self.run_step(
                "5. RAG System Demo",
                self._run_rag_demo
            )
        
        # Print summary
        self._print_summary()
    
    def _run_data_prep(self):
        """Run data preparation"""
        cleaner = DataCleaner()
        df = cleaner.run_pipeline()
        
        # Split dataset
        train, val, test = split_dataset()
        
        return df
    
    def _run_ml_training(self):
        """Run ML model training"""
        ml_pipeline = BaselineMLPipeline()
        ml_pipeline.run_pipeline()
    
    def _run_embeddings(self):
        """Generate embeddings"""
        emb_pipeline = EmbeddingPipeline()
        emb_pipeline.run_pipeline()
    
    def _run_search_index(self):
        """Build search index"""
        search_engine = SemanticSearchEngine()
        search_engine.load_data()
        search_engine.load_embedding_model()
        search_engine.build_index()
    
    def _run_rag_demo(self):
        """Run RAG system demo"""
        rag_system = TicketResolutionRAG()
        rag_system.setup()
        results = rag_system.demo()
        return results
    
    def _print_summary(self):
        """Print pipeline summary"""
        total_time = time.time() - self.start_time
        
        print("\n" + "="*70)
        print(" "*20 + "PIPELINE SUMMARY")
        print("="*70)
        
        print("\nStep Timings:")
        for step, timing in self.timings.items():
            print(f"  {step}: {timing:.2f}s ({timing/60:.1f}m)")
        
        print(f"\nTotal Pipeline Time: {total_time:.2f}s ({total_time/60:.1f}m)")
        
        print("\nGenerated Outputs:")
        print("  ✓ Cleaned dataset: data/processed/clean_tickets.csv")
        print("  ✓ Train/Val/Test splits: data/processed/")
        print("  ✓ ML models: models/baseline/")
        print("  ✓ Embeddings: models/embeddings/")
        print("  ✓ FAISS index: models/embeddings/faiss_index.bin")
        print("  ✓ Visualizations: outputs/visualizations/")
        print("  ✓ Reports: outputs/reports/")
        
        print("\nNext Steps:")
        print("  1. Review model performance in outputs/reports/")
        print("  2. Test semantic search with custom queries")
        print("  3. Optional: Run DL training with --dl flag")
        print("  4. Deploy API with: python scripts/api_server.py")
        print("  5. Try the web demo: python scripts/demo_app.py")
        
        print("\n" + "="*70)
        print(" "*15 + "✓ PIPELINE COMPLETE!")
        print("="*70 + "\n")

def main():
    parser = argparse.ArgumentParser(
        description="ITSM Ticket Classification ML/DL/LLM Pipeline"
    )
    
    parser.add_argument(
        '--skip-data-prep',
        action='store_true',
        help='Skip data preparation (use existing cleaned data)'
    )
    
    parser.add_argument(
        '--skip-ml',
        action='store_true',
        help='Skip ML model training'
    )
    
    parser.add_argument(
        '--skip-embeddings',
        action='store_true',
        help='Skip embedding generation'
    )
    
    parser.add_argument(
        '--dl',
        action='store_true',
        help='Include deep learning training (slow!)'
    )
    
    parser.add_argument(
        '--no-rag-demo',
        action='store_true',
        help='Skip RAG demo'
    )
    
    parser.add_argument(
        '--quick',
        action='store_true',
        help='Quick run (data prep + ML only)'
    )
    
    args = parser.parse_args()
    
    # Quick mode settings
    if args.quick:
        args.skip_embeddings = True
        args.dl = False
        args.no_rag_demo = True
    
    # Create and run pipeline
    pipeline = ITSMPipeline()
    pipeline.run_full_pipeline(
        skip_data_prep=args.skip_data_prep,
        skip_ml=args.skip_ml,
        skip_embeddings=args.skip_embeddings,
        skip_dl=not args.dl,
        run_rag_demo=not args.no_rag_demo
    )

if __name__ == "__main__":
    main()
