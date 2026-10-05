# Code Explanation - ITSM AI Hackathon Project

This document explains every component of the full-stack application in detail.

---

## Table of Contents

1. [Backend Architecture](#backend-architecture)
2. [Frontend Architecture](#frontend-architecture)
3. [AI/ML Integration](#aiml-integration)
4. [Database Design](#database-design)
5. [API Design](#api-design)
6. [Key Algorithms](#key-algorithms)
7. [Security Considerations](#security-considerations)

---

## Backend Architecture

### Django Project Structure

The backend uses Django 4.2 with Django REST Framework for API development.

#### `itsm_backend/settings.py`

**Purpose:** Central configuration for the entire Django project.

**Key Sections:**

1. **Database Configuration:**
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='itsm_db'),
        ...
    }
}
```
- Uses PostgreSQL (production-grade database)
- Connection details from environment variables
- Supports connection pooling for better performance

2. **CORS Configuration:**
```python
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://localhost:3000',
    cast=Csv()
)
```
- Allows frontend (React) to make API requests
- Critical for development and production
- Uses comma-separated list from .env

3. **REST Framework Settings:**
```python
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    ...
}
```
- Currently allows all requests (for hackathon)
- In production, would use JWT or Token authentication
- Pagination set to 20 items per page

#### `tickets/models.py`

**Purpose:** Defines database schema using Django ORM.

**Key Models:**

1. **Ticket Model:**
```python
class Ticket(models.Model):
    title = models.CharField(max_length=500)
    description = models.TextField()
    predicted_category = models.CharField(max_length=100, blank=True)
    confidence_score = models.FloatField(blank=True, null=True)
    ...
```

**Explanation:**
- `title`: Short description of issue
- `description`: Detailed explanation
- `predicted_category`: Set by AI model
- `confidence_score`: 0-1 range, higher = more confident
- `status`: Tracks ticket lifecycle (open → in_progress → resolved → closed)
- `priority`: Business importance (low, medium, high, critical)

**Auto-save Logic:**
```python
def save(self, *args, **kwargs):
    if self.status == 'resolved' and not self.resolved_at:
        self.resolved_at = timezone.now()
    super().save(*args, **kwargs)
```
- Automatically sets `resolved_at` timestamp when status changes
- Ensures data consistency

2. **TicketResolution Model:**
```python
class TicketResolution(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE)
    resolution_text = models.TextField()
    method = models.CharField(max_length=50)
    ...
```

**Explanation:**
- Links to ticket (foreign key relationship)
- Stores AI-generated resolution
- Tracks which method generated it (LLM, rule-based, similar tickets)
- Can have multiple resolutions per ticket

#### `api/serializers.py`

**Purpose:** Convert Django models to/from JSON for API responses.

**Example:**
```python
class TicketSerializer(serializers.ModelSerializer):
    resolutions = TicketResolutionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Ticket
        fields = ['id', 'title', 'description', ...]
```

**Explanation:**
- `ModelSerializer`: Auto-generates fields from model
- `many=True`: Returns list of resolutions
- `read_only=True`: Not required in POST requests
- Nested serializers provide complete data in single request

#### `api/ai_service.py`

**Purpose:** Bridge between Django and AI/ML models.

**Key Classes:**

1. **MLModelService:**
```python
class MLModelService:
    def load_models(self):
        self.model = joblib.load(settings.ML_MODEL_PATH)
        self.vectorizer = joblib.load(settings.TFIDF_PATH)
        self.label_encoder = joblib.load(settings.LABEL_ENCODER_PATH)
```

**Explanation:**
- Loads trained scikit-learn models from disk
- Models trained in `ai-models/` directory
- Loaded once at startup (not per-request)
- Cached in memory for fast predictions

2. **Prediction Process:**
```python
def predict(self, title: str, description: str) -> Dict:
    text = f"{title} {description}"
    features = self.vectorizer.transform([text])
    prediction = self.model.predict(features)[0]
    ...
```

**Step-by-step:**
1. Combine title + description into single text
2. Convert text to TF-IDF features (vectorization)
3. Feed features to ML model
4. Get predicted category and confidence
5. Return all class probabilities

3. **SemanticSearchService:**
```python
class SemanticSearchService:
    def search(self, query: str, k: int = 5):
        query_embedding = self.embedding_model.encode([query])
        faiss.normalize_L2(query_embedding)
        distances, indices = self.faiss_index.search(query_embedding, k)
```

**How it works:**
1. Convert query text to 384-dimensional vector using Sentence-BERT
2. Normalize vector for cosine similarity
3. Search FAISS index for k nearest neighbors
4. Return similar tickets with similarity scores

**Why FAISS?**
- Ultra-fast similarity search (millions of vectors in milliseconds)
- Uses optimized C++ code
- Supports GPU acceleration
- Industry standard for vector search

4. **RAGService:**
```python
def generate_resolution(self, title, description, use_llm=False):
    # Get category prediction
    prediction = self.ml_service.predict(title, description)
    
    # Find similar tickets
    similar_tickets = self.search_service.search(query, k=5)
    
    # Generate resolution
    if use_llm:
        resolution = self._generate_llm_resolution(...)
    else:
        resolution = self._generate_rule_based_resolution(...)
```

**RAG Approach:**
1. **Retrieval:** Find 5 most similar historical tickets
2. **Augmentation:** Use their context to inform resolution
3. **Generation:** Create resolution using rules or LLM

**Rule-based Generation:**
```python
def _generate_rule_based_resolution(self, category, similar_tickets):
    # Category-specific guidance
    category_guidance = {
        'Password Reset': "1. Verify user identity\n2. Use password reset tool...",
        ...
    }
    
    resolution = category_guidance.get(category, default_steps)
    
    # Add similar tickets context
    for ticket in similar_tickets[:3]:
        resolution += f"Similar: {ticket['title']}\n"
```

**Why rule-based?**
- No OpenAI API key required
- Instant responses (no API latency)
- Deterministic and explainable
- Good for hackathon demo

#### `api/views.py`

**Purpose:** API endpoints - handle HTTP requests/responses.

**Example Endpoint:**
```python
@api_view(['POST'])
def predict_category(request):
    # Validate input
    serializer = PredictionRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    
    # Check service available
    if not ml_service.loaded:
        return Response({'error': 'ML model not loaded'}, status=503)
    
    # Make prediction
    result = ml_service.predict(
        serializer.validated_data['title'],
        serializer.validated_data['description']
    )
    
    return Response(result)
```

**Request Flow:**
1. Client sends POST request with JSON body
2. DRF deserializes JSON using serializer
3. Validates required fields exist
4. Checks if ML service is ready
5. Calls AI service for prediction
6. Returns JSON response

**Error Handling:**
- 400: Bad request (invalid input)
- 503: Service unavailable (models not loaded)
- 500: Internal server error (unexpected)

**ViewSet Example:**
```python
class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
```

**What this provides:**
- GET /api/tickets/ - List all tickets
- POST /api/tickets/ - Create ticket
- GET /api/tickets/{id}/ - Get specific ticket
- PUT /api/tickets/{id}/ - Update ticket
- DELETE /api/tickets/{id}/ - Delete ticket

All CRUD operations in ~5 lines of code!

---

## Frontend Architecture

### React + Vite Setup

#### `vite.config.js`

**Purpose:** Configure Vite build tool.

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

**Proxy Configuration:**
- Forwards `/api/*` requests to Django backend
- Avoids CORS issues in development
- Changes origin header to match backend

#### `src/App.jsx`

**Purpose:** Main application component with routing.

```javascript
function App() {
  return (
    <Router>
      <div className="flex h-screen">
        <Sidebar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<TicketList />} />
            ...
          </Routes>
        </main>
      </div>
    </Router>
  );
}
```

**How it works:**
- `BrowserRouter`: Enables client-side routing
- `Routes`: Contains all route definitions
- `Route`: Maps URL path to component
- Changes URL without page reload (SPA)

#### `src/services/api.js`

**Purpose:** Centralized API client using axios.

```javascript
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

const apiService = {
  createTicket: (data) => api.post('/tickets/', data),
  predictCategory: (data) => api.post('/predict/', data),
  ...
};
```

**Benefits:**
- Single source of truth for API calls
- Consistent error handling
- Easy to add interceptors (auth tokens, etc.)
- TypeScript-ready

**Usage in components:**
```javascript
import apiService from '../services/api';

const createTicket = async () => {
  try {
    const response = await apiService.createTicket(formData);
    setTicket(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

#### `src/pages/Dashboard.jsx`

**Purpose:** Display analytics and statistics.

**Data Flow:**
```javascript
useEffect(() => {
  loadStats();
}, []);

const loadStats = async () => {
  const response = await apiService.getStats();
  setStats(response.data);
};
```

1. Component mounts → `useEffect` runs
2. Calls `loadStats()` function
3. Makes API request to `/api/stats/`
4. Updates state with `setStats()`
5. Component re-renders with new data

**Charts with Recharts:**
```javascript
<ResponsiveContainer width="100%" height={300}>
  <PieChart>
    <Pie
      data={statusData}
      dataKey="value"
      nameKey="name"
      cx="50%"
      cy="50%"
      outerRadius={100}
    >
      {statusData.map((entry, index) => (
        <Cell key={index} fill={COLORS[index]} />
      ))}
    </Pie>
  </PieChart>
</ResponsiveContainer>
```

**Component breakdown:**
- `ResponsiveContainer`: Auto-sizes chart to container
- `PieChart`: Chart type
- `Pie`: Data series
- `Cell`: Individual slice with color

#### `src/pages/NewTicket.jsx`

**Purpose:** Create ticket with AI prediction.

**Form State Management:**
```javascript
const [formData, setFormData] = useState({
  title: '',
  description: '',
  priority: 'medium',
});

const handleChange = (e) => {
  setFormData({
    ...formData,
    [e.target.name]: e.target.value
  });
};
```

**AI Prediction Flow:**
```javascript
const handlePredict = async () => {
  const response = await apiService.predictCategory({
    title: formData.title,
    description: formData.description,
  });
  setPrediction(response.data);
};
```

1. User clicks "AI Predict" button
2. Sends current title + description to API
3. Receives predicted category + confidence
4. Displays in UI
5. User can still edit before submitting

**Form Submission:**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();  // Prevent page reload
  await apiService.createTicket(formData);
  navigate('/tickets');  // Redirect to ticket list
};
```

#### `src/pages/AnalyzeTicket.jsx`

**Purpose:** Complete ticket analysis with all AI features.

**Comprehensive Analysis:**
```javascript
const handleAnalyze = async () => {
  const response = await apiService.analyzeTicket(query);
  setAnalysis(response.data);
};
```

**Response structure:**
```javascript
{
  prediction: {
    category: "Email Issues",
    confidence: 0.92
  },
  similar_tickets: [
    { title: "...", similarity: 0.85, ... }
  ],
  resolution: {
    text: "Step 1: ...",
    method: "rule_based"
  }
}
```

**UI Display:**
- Prediction card: Category + confidence
- Similar tickets list: Top 5 matches with similarity %
- Resolution panel: Step-by-step instructions

---

## AI/ML Integration

### Model Training Pipeline

Located in `ai-models/src/`

#### `train_ml_models.py`

**Purpose:** Train classification models.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

# TF-IDF Vectorization
vectorizer = TfidfVectorizer(
    max_features=10000,
    ngram_range=(1, 2),
    min_df=2,
    max_df=0.95
)
X_train = vectorizer.fit_transform(train_texts)

# Train models
models = {
    'logistic': LogisticRegression(max_iter=1000),
    'random_forest': RandomForestClassifier(n_estimators=100),
    'xgboost': XGBClassifier(n_estimators=100)
}

for name, model in models.items():
    model.fit(X_train, y_train)
    score = model.score(X_test, y_test)
    print(f"{name}: {score:.3f}")
```

**TF-IDF Explained:**
- **TF** (Term Frequency): How often word appears in document
- **IDF** (Inverse Document Frequency): How unique word is across corpus
- Result: Matrix of features (words) × documents

**Why these models?**
- **Logistic Regression**: Fast, interpretable baseline
- **Random Forest**: Handles non-linear relationships
- **XGBoost**: State-of-the-art gradient boosting

#### `embeddings_and_search.py`

**Purpose:** Create semantic search index.

```python
from sentence_transformers import SentenceTransformer
import faiss

# Load model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Generate embeddings
embeddings = model.encode(
    tickets['text'].tolist(),
    batch_size=32,
    show_progress_bar=True
)

# Build FAISS index
index = faiss.IndexFlatIP(384)  # Inner product (cosine similarity)
faiss.normalize_L2(embeddings)
index.add(embeddings)

# Save
faiss.write_index(index, 'faiss_index.bin')
```

**Sentence-BERT:**
- Converts text to 384-dimensional vectors
- Pre-trained on sentence similarity tasks
- Captures semantic meaning (not just keywords)

**Example:**
- "Can't log in" and "Login failed" have similar embeddings
- Even though they share no exact words!

**FAISS Index:**
- `IndexFlatIP`: Exact search using inner product
- Normalized vectors → cosine similarity
- Alternative: `IndexIVFFlat` for approximate search (faster, slight accuracy loss)

#### `llm_rag.py`

**Purpose:** Generate resolutions using RAG.

```python
def generate_resolution(ticket_text):
    # 1. Retrieve similar tickets
    similar = search_index.search(ticket_text, k=5)
    
    # 2. Build context
    context = "Similar resolved tickets:\n"
    for ticket in similar:
        context += f"- {ticket['title']}: {ticket['resolution']}\n"
    
    # 3. Generate (LLM or rules)
    if use_openai:
        prompt = f"Context:\n{context}\n\nTicket:\n{ticket_text}\n\nResolution:"
        resolution = openai_client.complete(prompt)
    else:
        resolution = rule_based_resolution(context, ticket_text)
    
    return resolution
```

**RAG Benefits:**
- Grounds LLM responses in real data
- Reduces hallucination
- Provides citations (similar tickets)
- Works without LLM (rule-based fallback)

---

## Database Design

### Entity Relationship

```
Ticket (1) ←→ (N) TicketResolution
Ticket (1) ←→ (N) SimilarTicket
Ticket (N) ←→ (1) TicketCategory
Ticket (N) ←→ (1) User (created_by)
Ticket (N) ←→ (1) User (assigned_to)
```

### Indexing Strategy

```python
class Meta:
    indexes = [
        models.Index(fields=['-created_at']),
        models.Index(fields=['status']),
        models.Index(fields=['predicted_category']),
    ]
```

**Why index these fields?**
- `created_at`: Frequently sorted/filtered
- `status`: Common in WHERE clauses
- `predicted_category`: Used in analytics

**Performance impact:**
- Without index: O(n) table scan
- With index: O(log n) B-tree search
- Critical for large datasets

### Data Validation

```python
class Ticket(models.Model):
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='medium'
    )
```

**Database-level constraints:**
- `choices`: Only allowed values
- `max_length`: Prevents overflow
- `default`: Ensures value always set
- `null=False`: Required field

---

## API Design

### RESTful Principles

```
GET    /api/tickets/          - List tickets
POST   /api/tickets/          - Create ticket
GET    /api/tickets/{id}/     - Get ticket
PUT    /api/tickets/{id}/     - Update ticket (full)
PATCH  /api/tickets/{id}/     - Update ticket (partial)
DELETE /api/tickets/{id}/     - Delete ticket
```

**Resource-oriented:**
- Nouns (tickets) not verbs (get_tickets)
- HTTP methods indicate action
- Predictable URL structure

### Pagination

```python
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
```

**URL examples:**
- `/api/tickets/` - First page (20 items)
- `/api/tickets/?page=2` - Second page
- `/api/tickets/?page_size=50` - 50 items per page

**Response format:**
```json
{
  "count": 150,
  "next": "http://.../api/tickets/?page=2",
  "previous": null,
  "results": [...]
}
```

### Error Responses

```python
try:
    result = ml_service.predict(title, description)
    return Response(result, status=200)
except ValueError as e:
    return Response({'error': str(e)}, status=400)
except Exception as e:
    return Response({'error': 'Internal error'}, status=500)
```

**HTTP Status Codes:**
- 200: Success
- 201: Created
- 400: Bad request (client error)
- 404: Not found
- 500: Server error
- 503: Service unavailable

---

## Key Algorithms

### TF-IDF Vectorization

```
TF(word, document) = count(word) / total_words
IDF(word, corpus) = log(total_docs / docs_containing_word)
TF-IDF(word, doc) = TF * IDF
```

**Example:**
```
Document: "password reset password"
- TF("password") = 2/3 = 0.67
- IDF("password") = log(1000/500) = 0.3
- TF-IDF = 0.67 * 0.3 = 0.2
```

### Cosine Similarity

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

**Range:** -1 to 1 (for normalized vectors: 0 to 1)

**Example:**
```python
# Vector representations
ticket_a = [0.2, 0.5, 0.1]
ticket_b = [0.3, 0.4, 0.2]

# Dot product
dot = sum(a*b for a,b in zip(ticket_a, ticket_b))

# Magnitudes
mag_a = sqrt(sum(x**2 for x in ticket_a))
mag_b = sqrt(sum(x**2 for x in ticket_b))

# Similarity
similarity = dot / (mag_a * mag_b)
```

### Classification Pipeline

```
Raw Text → Cleaning → TF-IDF → ML Model → Prediction
"Can't login!" → "cant login" → [0.2, 0.5, ...] → LogReg → "Password Reset"
```

**Steps:**
1. **Text cleaning:** Lowercase, remove punctuation
2. **Tokenization:** Split into words
3. **Vectorization:** Convert to numbers
4. **Classification:** Apply trained model
5. **Post-processing:** Map to category name

---

## Security Considerations

### Current Setup (Hackathon)

```python
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}
```

**⚠️ NOT for production!**

### Production Recommendations

1. **Authentication:**
```python
'DEFAULT_AUTHENTICATION_CLASSES': [
    'rest_framework_simplejwt.authentication.JWTAuthentication',
],
'DEFAULT_PERMISSION_CLASSES': [
    'rest_framework.permissions.IsAuthenticated',
],
```

2. **HTTPS Only:**
```python
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

3. **Rate Limiting:**
```python
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

'DEFAULT_THROTTLE_CLASSES': [
    'rest_framework.throttling.AnonRateThrottle',
    'rest_framework.throttling.UserRateThrottle'
],
'DEFAULT_THROTTLE_RATES': {
    'anon': '100/day',
    'user': '1000/day'
}
```

4. **Input Validation:**
```python
class TicketSerializer(serializers.ModelSerializer):
    title = serializers.CharField(max_length=500, required=True)
    description = serializers.CharField(max_length=5000, required=True)
    
    def validate_title(self, value):
        if len(value) < 10:
            raise serializers.ValidationError("Title too short")
        return value
```

5. **SQL Injection Protection:**
- Django ORM automatically escapes queries
- Never use raw SQL without parameters

6. **XSS Protection:**
- React automatically escapes output
- Django templates escape by default

---

## Performance Optimization

### Database

1. **Select Related:**
```python
# Bad: N+1 queries
tickets = Ticket.objects.all()
for ticket in tickets:
    print(ticket.category.name)  # Extra query per ticket!

# Good: 1 query
tickets = Ticket.objects.select_related('category').all()
```

2. **Prefetch Related:**
```python
# Good for many-to-many
tickets = Ticket.objects.prefetch_related('resolutions').all()
```

3. **Database Indexes:**
```python
# Add to commonly filtered fields
indexes = [
    models.Index(fields=['created_at', 'status']),
]
```

### Caching

```python
from django.core.cache import cache

def get_stats():
    stats = cache.get('dashboard_stats')
    if stats is None:
        stats = calculate_stats()
        cache.set('dashboard_stats', stats, 300)  # 5 minutes
    return stats
```

### Frontend

1. **Code Splitting:**
```javascript
// Load components on demand
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

2. **Memoization:**
```javascript
const expensiveCalculation = useMemo(() => {
  return processData(data);
}, [data]);
```

3. **Debouncing:**
```javascript
const debouncedSearch = debounce((query) => {
  apiService.search(query);
}, 300);
```

---

## Testing Recommendations

### Backend Tests

```python
from django.test import TestCase
from tickets.models import Ticket

class TicketTestCase(TestCase):
    def test_create_ticket(self):
        ticket = Ticket.objects.create(
            title="Test ticket",
            description="Test description"
        )
        self.assertEqual(ticket.status, 'open')
    
    def test_prediction_api(self):
        response = self.client.post('/api/predict/', {
            'title': 'Password issue',
            'description': 'Cannot login'
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('category', response.json())
```

### Frontend Tests

```javascript
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

test('renders dashboard title', () => {
  render(<Dashboard />);
  const title = screen.getByText(/Dashboard/i);
  expect(title).toBeInTheDocument();
});
```

---

## Scaling Considerations

### Horizontal Scaling

```
                    Load Balancer
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    Django 1         Django 2         Django 3
        │                │                │
        └────────────────┼────────────────┘
                         │
                   PostgreSQL
                    (+ Read Replicas)
```

### Caching Layer

```
Django → Redis → PostgreSQL
```

### Background Tasks

```python
# Use Celery for async processing
@celery_app.task
def train_models():
    # Long-running task
    pipeline.train()
```

---

**This document should help judges and developers understand every aspect of the codebase!**
