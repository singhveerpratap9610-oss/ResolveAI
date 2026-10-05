"""
LLM-based Resolution Generator with RAG
Uses retrieval-augmented generation for ticket resolution
"""
import pandas as pd
import numpy as np
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from configs.config import *
from embeddings_and_search import SemanticSearchEngine
from typing import List, Dict, Optional
import json

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("Warning: OpenAI library not installed. LLM features will be limited.")

class TicketResolutionRAG:
    """RAG system for generating ticket resolutions"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or OPENAI_API_KEY
        self.search_engine = SemanticSearchEngine()
        self.df = None
        
        if OPENAI_AVAILABLE and self.api_key:
            openai.api_key = self.api_key
        
    def setup(self):
        """Setup the RAG system"""
        print("=" * 50)
        print("SETTING UP RAG SYSTEM")
        print("=" * 50)
        
        # Load data and embeddings
        print("\nLoading data and search engine...")
        self.search_engine.load_data()
        self.search_engine.load_embedding_model()
        
        # Load or build index
        try:
            self.search_engine.load_index()
        except FileNotFoundError:
            print("Index not found. Building new index...")
            self.search_engine.build_index()
        
        self.df = self.search_engine.df
        print("✓ RAG system ready")
    
    def retrieve_similar_tickets(self, query: str, k: int = 5) -> List[Dict]:
        """Retrieve similar resolved tickets"""
        results = self.search_engine.search(query, k=k)
        
        # Filter for resolved tickets with resolution comments
        resolved_tickets = []
        for idx, similarity, ticket in results:
            if pd.notna(ticket.get('Resolution Comments')):
                resolved_tickets.append({
                    'similarity': similarity,
                    'category': ticket.get(TARGET_COLUMN, 'N/A'),
                    'title': ticket.get('Title', ''),
                    'description': ticket.get('Description', ''),
                    'resolution': ticket.get('Resolution Comments', ''),
                    'priority': ticket.get('Priority', 'N/A')
                })
        
        return resolved_tickets
    
    def build_context(self, similar_tickets: List[Dict]) -> str:
        """Build context from similar tickets for LLM"""
        if not similar_tickets:
            return "No similar resolved tickets found."
        
        context = "Here are similar resolved tickets:\n\n"
        
        for i, ticket in enumerate(similar_tickets, 1):
            context += f"--- Ticket {i} (Similarity: {ticket['similarity']:.2f}) ---\n"
            context += f"Category: {ticket['category']}\n"
            context += f"Issue: {ticket['description'][:200]}...\n"
            context += f"Resolution: {ticket['resolution'][:300]}...\n\n"
        
        return context
    
    def generate_resolution_openai(
        self, 
        ticket_description: str,
        ticket_title: str = "",
        context: str = ""
    ) -> str:
        """Generate resolution using OpenAI API"""
        
        if not OPENAI_AVAILABLE:
            return "OpenAI library not installed. Cannot generate resolution."
        
        if not self.api_key:
            return "OpenAI API key not configured. Cannot generate resolution."
        
        prompt = f"""You are an expert IT service desk agent. Based on similar resolved tickets and your expertise, provide a clear, actionable resolution for the following ticket.

Ticket Title: {ticket_title}
Ticket Description: {ticket_description}

{context}

Provide a professional resolution that:
1. Addresses the root cause
2. Gives clear step-by-step instructions
3. Mentions any prerequisites or permissions needed
4. Is concise but complete

Resolution:"""
        
        try:
            response = openai.ChatCompletion.create(
                model=LLM_CONFIG['model'],
                messages=[
                    {"role": "system", "content": "You are an expert IT service desk agent providing technical resolutions."},
                    {"role": "user", "content": prompt}
                ],
                temperature=LLM_CONFIG['temperature'],
                max_tokens=LLM_CONFIG['max_tokens'],
                top_p=LLM_CONFIG['top_p']
            )
            
            resolution = response.choices[0].message.content.strip()
            return resolution
            
        except Exception as e:
            return f"Error generating resolution: {str(e)}"
    
    def generate_resolution_rule_based(
        self,
        ticket_description: str,
        similar_tickets: List[Dict]
    ) -> str:
        """Generate resolution using rule-based approach (fallback)"""
        
        if not similar_tickets:
            return "Unable to find similar resolved tickets. Please escalate to appropriate support team."
        
        # Use the most similar ticket's resolution as base
        best_match = similar_tickets[0]
        
        resolution = f"""Based on similar ticket (Category: {best_match['category']}):

{best_match['resolution']}

Note: This resolution is based on a similar past ticket. Please verify the steps are appropriate for your specific case.

Additional considerations:
- Verify user permissions and access rights
- Check if any recent system changes might affect the resolution
- Document the actual steps taken for future reference
"""
        
        return resolution
    
    def process_ticket(
        self,
        ticket_description: str,
        ticket_title: str = "",
        use_llm: bool = True,
        k_similar: int = 5
    ) -> Dict:
        """
        Process a ticket and generate resolution
        
        Args:
            ticket_description: Ticket description
            ticket_title: Ticket title
            use_llm: Whether to use LLM or rule-based approach
            k_similar: Number of similar tickets to retrieve
            
        Returns:
            Dictionary with resolution and metadata
        """
        print(f"\n{'='*70}")
        print("PROCESSING TICKET")
        print(f"{'='*70}")
        print(f"Title: {ticket_title}")
        print(f"Description: {ticket_description[:200]}...")
        
        # Retrieve similar tickets
        print("\nRetrieving similar tickets...")
        query = f"{ticket_title} {ticket_description}"
        similar_tickets = self.retrieve_similar_tickets(query, k=k_similar)
        
        print(f"Found {len(similar_tickets)} similar resolved tickets")
        
        # Build context
        context = self.build_context(similar_tickets)
        
        # Generate resolution
        print("\nGenerating resolution...")
        if use_llm and OPENAI_AVAILABLE and self.api_key:
            resolution = self.generate_resolution_openai(
                ticket_description,
                ticket_title,
                context
            )
            method = "LLM (OpenAI)"
        else:
            resolution = self.generate_resolution_rule_based(
                ticket_description,
                similar_tickets
            )
            method = "Rule-based"
        
        # Predict category from most similar ticket
        predicted_category = similar_tickets[0]['category'] if similar_tickets else "Unknown"
        
        result = {
            'title': ticket_title,
            'description': ticket_description,
            'predicted_category': predicted_category,
            'resolution': resolution,
            'similar_tickets_count': len(similar_tickets),
            'resolution_method': method,
            'similar_tickets': similar_tickets[:3]  # Top 3
        }
        
        print(f"\n{'='*70}")
        print(f"GENERATED RESOLUTION ({method})")
        print(f"{'='*70}")
        print(f"Predicted Category: {predicted_category}")
        print(f"\nResolution:\n{resolution}")
        print(f"{'='*70}\n")
        
        return result
    
    def demo(self, sample_tickets: Optional[List[Dict]] = None):
        """Demo the RAG system with sample tickets"""
        
        if sample_tickets is None:
            sample_tickets = [
                {
                    'title': 'Unable to access shared folder',
                    'description': 'User cannot access the HR shared folder. Getting permission denied error when trying to open.'
                },
                {
                    'title': 'Database connection timeout',
                    'description': 'Oracle database connection is timing out. Application shows error after 30 seconds of trying to connect.'
                },
                {
                    'title': 'Email not syncing',
                    'description': 'User emails are not syncing to mobile device. Desktop Outlook works fine but mobile app shows old emails.'
                }
            ]
        
        print("\n" + "=" * 70)
        print("RAG SYSTEM DEMO")
        print("=" * 70)
        
        results = []
        for ticket in sample_tickets:
            result = self.process_ticket(
                ticket['description'],
                ticket['title'],
                use_llm=False  # Use rule-based for demo
            )
            results.append(result)
        
        # Save demo results
        output_path = OUTPUTS_DIR / "reports" / "rag_demo_results.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n✓ Demo results saved to {output_path}")
        
        return results
    
    def save_resolution(self, result: Dict, filename: str = "resolution.json"):
        """Save resolution to file"""
        output_path = OUTPUTS_DIR / "reports" / filename
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"✓ Resolution saved to {output_path}")

class TicketAnalyzer:
    """Analyze tickets and provide insights using LLM"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or OPENAI_API_KEY
        if OPENAI_AVAILABLE and self.api_key:
            openai.api_key = self.api_key
    
    def analyze_trends(self, df: pd.DataFrame, time_period: str = "month") -> str:
        """Analyze ticket trends using LLM"""
        
        if not OPENAI_AVAILABLE or not self.api_key:
            return "OpenAI not configured. Cannot perform analysis."
        
        # Prepare summary statistics
        stats = {
            'total_tickets': len(df),
            'top_categories': df[TARGET_COLUMN].value_counts().head(5).to_dict(),
            'priority_distribution': df[PRIORITY_COLUMN].value_counts().to_dict() if PRIORITY_COLUMN in df.columns else {},
            'avg_resolution_time': 'N/A'  # Would need to calculate from datetime fields
        }
        
        prompt = f"""Analyze the following IT ticket statistics and provide insights:

Total Tickets: {stats['total_tickets']}

Top 5 Categories:
{json.dumps(stats['top_categories'], indent=2)}

Priority Distribution:
{json.dumps(stats['priority_distribution'], indent=2)}

Provide:
1. Key insights and trends
2. Potential problem areas
3. Recommendations for improvement
4. Resource allocation suggestions

Analysis:"""
        
        try:
            response = openai.ChatCompletion.create(
                model=LLM_CONFIG['model'],
                messages=[
                    {"role": "system", "content": "You are an IT service management analyst."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=800
            )
            
            analysis = response.choices[0].message.content.strip()
            return analysis
            
        except Exception as e:
            return f"Error generating analysis: {str(e)}"

if __name__ == "__main__":
    # Setup and run demo
    rag_system = TicketResolutionRAG()
    rag_system.setup()
    
    # Run demo
    results = rag_system.demo()
    
    print("\n" + "=" * 70)
    print("✓ RAG SYSTEM DEMO COMPLETE")
    print("=" * 70)
