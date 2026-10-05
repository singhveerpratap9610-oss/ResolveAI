"""
Example Usage Scripts
Demonstrates how to use the trained models and components
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent / "src"))

import joblib
import pandas as pd
from embeddings_and_search import SemanticSearchEngine
from llm_rag import TicketResolutionRAG

# ===== EXAMPLE 1: Make Predictions =====
print("="*70)
print("EXAMPLE 1: Predict Ticket Category")
print("="*70)

# Load models
model = joblib.load("../models/baseline/model.joblib")
vectorizer = joblib.load("../models/baseline/tfidf.joblib")
encoder = joblib.load("../models/baseline/label_encoder.joblib")

# Example tickets
example_tickets = [
    "Server is down and not responding to ping",
    "Need access to shared folder on HR drive",
    "Oracle database connection timeout error",
    "Backup failed last night with error code 1045"
]

print("\nPredictions:")
for text in example_tickets:
    features = vectorizer.transform([text])
    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    
    category = encoder.inverse_transform([prediction])[0]
    confidence = probabilities[prediction]
    
    print(f"\nTicket: {text}")
    print(f"→ Category: {category}")
    print(f"→ Confidence: {confidence:.2%}")

# ===== EXAMPLE 2: Semantic Search =====
print("\n" + "="*70)
print("EXAMPLE 2: Find Similar Tickets")
print("="*70)

# Initialize search engine
search_engine = SemanticSearchEngine()
search_engine.load_data()
search_engine.load_embedding_model()
search_engine.load_index()

# Search for similar tickets
query = "database connection problem"
results = search_engine.search(query, k=3)

print(f"\nQuery: '{query}'")
print(f"Top 3 similar tickets:\n")

for i, (idx, similarity, ticket) in enumerate(results, 1):
    print(f"{i}. Similarity: {similarity:.3f}")
    print(f"   Category: {ticket.get('Service Category', 'N/A')}")
    print(f"   Title: {ticket.get('Title', '')[:80]}...")
    print()

# ===== EXAMPLE 3: Generate Resolution =====
print("="*70)
print("EXAMPLE 3: Generate Ticket Resolution")
print("="*70)

# Initialize RAG system
rag = TicketResolutionRAG()
rag.setup()

# Process a ticket
new_ticket = {
    'title': 'Cannot access email on mobile',
    'description': 'User unable to sync email to iPhone. Desktop Outlook works fine but mobile app shows connection error.'
}

result = rag.process_ticket(
    new_ticket['description'],
    new_ticket['title'],
    use_llm=False  # Set to True if you have OpenAI API key
)

print(f"\nTicket: {new_ticket['title']}")
print(f"Predicted Category: {result['predicted_category']}")
print(f"\nGenerated Resolution:")
print("-" * 70)
print(result['resolution'])
print("-" * 70)

# ===== EXAMPLE 4: Batch Processing =====
print("\n" + "="*70)
print("EXAMPLE 4: Batch Process Multiple Tickets")
print("="*70)

batch_tickets = [
    {
        'id': 'TICKET-001',
        'text': 'Server maintenance required for production environment'
    },
    {
        'id': 'TICKET-002',
        'text': 'User password reset needed urgently'
    },
    {
        'id': 'TICKET-003',
        'text': 'Storage space running low on backup server'
    }
]

print("\nProcessing batch of tickets...")
results = []

for ticket in batch_tickets:
    features = vectorizer.transform([ticket['text']])
    prediction = model.predict(features)[0]
    category = encoder.inverse_transform([prediction])[0]
    
    results.append({
        'id': ticket['id'],
        'category': category,
        'text': ticket['text'][:50] + '...'
    })

# Display results
print("\nResults:")
for result in results:
    print(f"\n{result['id']}")
    print(f"  Text: {result['text']}")
    print(f"  → Category: {result['category']}")

# ===== EXAMPLE 5: Model Comparison =====
print("\n" + "="*70)
print("EXAMPLE 5: Compare Predictions Across Models")
print("="*70)

test_ticket = "Database backup failure with error code 5012"
features = vectorizer.transform([test_ticket])

print(f"\nTicket: {test_ticket}\n")

# Get top 3 predictions with probabilities
probabilities = model.predict_proba(features)[0]
top_3_indices = probabilities.argsort()[-3:][::-1]

print("Top 3 Predictions:")
for i, idx in enumerate(top_3_indices, 1):
    category = encoder.inverse_transform([idx])[0]
    confidence = probabilities[idx]
    print(f"{i}. {category}: {confidence:.2%}")

# ===== EXAMPLE 6: Save Predictions to CSV =====
print("\n" + "="*70)
print("EXAMPLE 6: Export Predictions to CSV")
print("="*70)

# Create sample predictions
predictions_data = []
for ticket in example_tickets:
    features = vectorizer.transform([ticket])
    prediction = model.predict(features)[0]
    category = encoder.inverse_transform([prediction])[0]
    confidence = model.predict_proba(features)[0][prediction]
    
    predictions_data.append({
        'ticket_description': ticket,
        'predicted_category': category,
        'confidence': f"{confidence:.2%}"
    })

# Save to CSV
output_df = pd.DataFrame(predictions_data)
output_path = Path("../outputs/reports/example_predictions.csv")
output_path.parent.mkdir(parents=True, exist_ok=True)
output_df.to_csv(output_path, index=False)

print(f"\n✓ Saved predictions to {output_path}")
print("\nSample output:")
print(output_df.to_string(index=False))

print("\n" + "="*70)
print("✓ ALL EXAMPLES COMPLETED")
print("="*70)
