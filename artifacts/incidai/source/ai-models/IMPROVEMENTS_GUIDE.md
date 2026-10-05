# 🚀 ITSM ML Project - Improvement & Customization Guide

This guide provides detailed instructions on how to improve and customize the ITSM ticket classification system for your specific needs.

---

## 📊 Table of Contents

1. [Performance Optimization](#performance-optimization)
2. [Feature Engineering](#feature-engineering)
3. [Model Improvements](#model-improvements)
4. [Advanced Techniques](#advanced-techniques)
5. [Production Enhancements](#production-enhancements)
6. [Integration Options](#integration-options)

---

## ⚡ Performance Optimization

### 1. Optimize Hyperparameters

**Automated Search:**
```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'C': [0.1, 1, 10, 100],
    'max_iter': [1000, 2000, 5000],
    'solver': ['lbfgs', 'liblinear', 'saga']
}

grid_search = GridSearchCV(
    LogisticRegression(),
    param_grid,
    cv=5,
    scoring='f1_weighted',
    n_jobs=-1
)
grid_search.fit(X_train, y_train)
best_model = grid_search.best_estimator_
```

### 2. Feature Selection

**Remove Low-Importance Features:**
```python
from sklearn.feature_selection import SelectKBest, chi2

selector = SelectKBest(chi2, k=3000)
X_train_selected = selector.fit_transform(X_train, y_train)
X_test_selected = selector.transform(X_test)

# Get selected feature names
selected_features = vectorizer.get_feature_names_out()[selector.get_support()]
```

### 3. Dimensionality Reduction

**Use TruncatedSVD (LSA):**
```python
from sklearn.decomposition import TruncatedSVD

svd = TruncatedSVD(n_components=300, random_state=42)
X_train_reduced = svd.fit_transform(X_train)
X_test_reduced = svd.transform(X_test)

print(f"Explained variance: {svd.explained_variance_ratio_.sum():.2%}")
```

### 4. Batch Processing for Large Datasets

```python
def process_in_batches(df, batch_size=1000):
    embeddings = []
    for i in range(0, len(df), batch_size):
        batch = df.iloc[i:i+batch_size]
        batch_embeddings = model.encode(batch['clean_text'].tolist())
        embeddings.append(batch_embeddings)
    return np.vstack(embeddings)
```

---

## 🔧 Feature Engineering

### 1. Advanced Text Features

```python
def add_advanced_features(df):
    # Sentiment analysis
    from textblob import TextBlob
    df['sentiment'] = df['clean_text'].apply(
        lambda x: TextBlob(x).sentiment.polarity
    )
    
    # Readability metrics
    df['avg_word_length'] = df['clean_text'].apply(
        lambda x: np.mean([len(word) for word in x.split()])
    )
    
    # Technical terms count
    tech_terms = ['server', 'database', 'network', 'access', 'error']
    df['tech_term_count'] = df['clean_text'].apply(
        lambda x: sum(term in x.lower() for term in tech_terms)
    )
    
    # Urgency indicators
    urgent_words = ['urgent', 'critical', 'asap', 'emergency', 'down']
    df['urgency_score'] = df['clean_text'].apply(
        lambda x: sum(word in x.lower() for word in urgent_words)
    )
    
    return df
```

### 2. Domain-Specific Features

```python
def extract_domain_features(df):
    # Extract error codes
    df['has_error_code'] = df['Description'].str.contains(
        r'error\s*\d+', 
        case=False, 
        regex=True
    ).astype(int)
    
    # Extract IP addresses
    df['has_ip'] = df['Description'].str.contains(
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}',
        regex=True
    ).astype(int)
    
    # Extract user mentions
    df['mentions_count'] = df['Description'].str.count(r'@\w+')
    
    # Time-based patterns
    df['is_business_hours'] = df['hour'].between(9, 17).astype(int)
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    
    return df
```

### 3. Categorical Feature Encoding

```python
from sklearn.preprocessing import LabelEncoder, OneHotEncoder

# Label encoding for ordinal features
priority_encoder = LabelEncoder()
df['priority_encoded'] = priority_encoder.fit_transform(df['Priority'])

# One-hot encoding for nominal features
location_dummies = pd.get_dummies(df['Location Name'], prefix='location')
df = pd.concat([df, location_dummies], axis=1)
```

---

## 🎯 Model Improvements

### 1. Ensemble Methods

**Stacking Classifier:**
```python
from sklearn.ensemble import StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

estimators = [
    ('lr', LogisticRegression(max_iter=1000)),
    ('rf', RandomForestClassifier(n_estimators=100)),
    ('xgb', XGBClassifier(n_estimators=100))
]

stacking_model = StackingClassifier(
    estimators=estimators,
    final_estimator=LogisticRegression(),
    cv=5
)

stacking_model.fit(X_train, y_train)
```

**Weighted Voting:**
```python
from sklearn.ensemble import VotingClassifier

voting_model = VotingClassifier(
    estimators=estimators,
    voting='soft',
    weights=[1, 2, 3]  # Give more weight to better models
)
```

### 2. Handle Class Imbalance

**SMOTE Oversampling:**
```python
from imblearn.over_sampling import SMOTE

smote = SMOTE(random_state=42)
X_train_balanced, y_train_balanced = smote.fit_resample(X_train, y_train)

model.fit(X_train_balanced, y_train_balanced)
```

**Class Weights:**
```python
from sklearn.utils.class_weight import compute_class_weight

class_weights = compute_class_weight(
    'balanced',
    classes=np.unique(y_train),
    y=y_train
)

model = LogisticRegression(class_weight={i: w for i, w in enumerate(class_weights)})
```

### 3. Calibrate Probabilities

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_model = CalibratedClassifierCV(
    base_model,
    method='sigmoid',
    cv=5
)
calibrated_model.fit(X_train, y_train)
```

### 4. Multi-Label Classification

```python
from sklearn.multioutput import MultiOutputClassifier

# Create multi-target labels
y_multi = df[[TARGET_COLUMN, CLASSIFICATION_COLUMN, PRIORITY_COLUMN]]

multi_model = MultiOutputClassifier(
    RandomForestClassifier(n_estimators=100)
)
multi_model.fit(X_train, y_multi_train)
```

---

## 🧠 Advanced Techniques

### 1. Active Learning

```python
from modAL.models import ActiveLearner
from modAL.uncertainty import uncertainty_sampling

# Initialize learner with small labeled set
learner = ActiveLearner(
    estimator=LogisticRegression(),
    query_strategy=uncertainty_sampling,
    X_training=X_initial,
    y_training=y_initial
)

# Query uncertain samples
n_queries = 100
for _ in range(n_queries):
    query_idx, query_instance = learner.query(X_pool)
    
    # Get label (in practice, from human annotator)
    y_new = y_pool[query_idx]
    
    # Teach the model
    learner.teach(query_instance, y_new)
    
    # Remove from pool
    X_pool = np.delete(X_pool, query_idx, axis=0)
    y_pool = np.delete(y_pool, query_idx)
```

### 2. Model Explainability with SHAP

```python
import shap

# For tree models
explainer = shap.TreeExplainer(random_forest_model)
shap_values = explainer.shap_values(X_test[:100])

# Summary plot
shap.summary_plot(shap_values, X_test[:100], 
                  feature_names=vectorizer.get_feature_names_out())

# Force plot for single prediction
shap.force_plot(explainer.expected_value[0], 
                shap_values[0][0], 
                X_test[0])
```

### 3. Few-Shot Learning with SetFit

```python
from setfit import SetFitModel, SetFitTrainer

# Load pre-trained model
model = SetFitModel.from_pretrained("sentence-transformers/all-mpnet-base-v2")

# Train with few examples
trainer = SetFitTrainer(
    model=model,
    train_dataset=few_shot_dataset,
    num_iterations=20,
    num_epochs=1
)

trainer.train()
predictions = model(test_texts)
```

### 4. Zero-Shot Classification

```python
from transformers import pipeline

classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)

categories = [
    "Server Management",
    "Database Issue",
    "Access Rights",
    "Backup Management"
]

result = classifier(
    ticket_text,
    candidate_labels=categories
)

print(f"Category: {result['labels'][0]}")
print(f"Confidence: {result['scores'][0]}")
```

### 5. Continual Learning

```python
class ContinualLearner:
    def __init__(self, base_model):
        self.model = base_model
        self.seen_classes = set()
    
    def partial_fit(self, X_new, y_new):
        # Update with new classes
        new_classes = set(y_new) - self.seen_classes
        if new_classes:
            print(f"Learning {len(new_classes)} new classes")
            self.seen_classes.update(new_classes)
        
        # Incremental training
        self.model.partial_fit(X_new, y_new, classes=list(self.seen_classes))
    
    def predict(self, X):
        return self.model.predict(X)

# Use with SGDClassifier
from sklearn.linear_model import SGDClassifier
base = SGDClassifier(loss='log', random_state=42)
learner = ContinualLearner(base)
```

---

## 🏭 Production Enhancements

### 1. Model Versioning with MLflow

```python
import mlflow
import mlflow.sklearn

mlflow.set_experiment("itsm_classification")

with mlflow.start_run():
    # Log parameters
    mlflow.log_param("model_type", "logistic_regression")
    mlflow.log_param("max_features", MAX_FEATURES)
    
    # Train model
    model.fit(X_train, y_train)
    
    # Log metrics
    accuracy = accuracy_score(y_test, model.predict(X_test))
    mlflow.log_metric("accuracy", accuracy)
    
    # Log model
    mlflow.sklearn.log_model(model, "model")
    
    # Log artifacts
    mlflow.log_artifact("confusion_matrix.png")
```

### 2. A/B Testing Framework

```python
class ModelABTest:
    def __init__(self, model_a, model_b, split_ratio=0.5):
        self.model_a = model_a
        self.model_b = model_b
        self.split_ratio = split_ratio
        self.results = {'a': [], 'b': []}
    
    def predict(self, X):
        import random
        
        use_model_a = random.random() < self.split_ratio
        
        if use_model_a:
            prediction = self.model_a.predict(X)
            self.results['a'].append(prediction)
            return prediction, 'model_a'
        else:
            prediction = self.model_b.predict(X)
            self.results['b'].append(prediction)
            return prediction, 'model_b'
    
    def get_statistics(self):
        return {
            'model_a_usage': len(self.results['a']),
            'model_b_usage': len(self.results['b'])
        }
```

### 3. Monitoring and Alerting

```python
class ModelMonitor:
    def __init__(self, threshold=0.7):
        self.threshold = threshold
        self.predictions = []
        self.confidences = []
    
    def log_prediction(self, prediction, confidence):
        self.predictions.append(prediction)
        self.confidences.append(confidence)
        
        # Check for drift
        if len(self.confidences) >= 100:
            avg_confidence = np.mean(self.confidences[-100:])
            if avg_confidence < self.threshold:
                self.alert(f"Model confidence dropped to {avg_confidence:.2f}")
    
    def alert(self, message):
        print(f"⚠️ ALERT: {message}")
        # Send email, Slack notification, etc.
```

### 4. Caching for Performance

```python
from functools import lru_cache
import hashlib

class PredictionCache:
    def __init__(self):
        self.cache = {}
    
    def get_hash(self, text):
        return hashlib.md5(text.encode()).hexdigest()
    
    def get_prediction(self, text):
        text_hash = self.get_hash(text)
        return self.cache.get(text_hash)
    
    def set_prediction(self, text, prediction):
        text_hash = self.get_hash(text)
        self.cache[text_hash] = prediction
    
    def predict_with_cache(self, model, text):
        cached = self.get_prediction(text)
        if cached:
            return cached, True  # From cache
        
        prediction = model.predict([text])[0]
        self.set_prediction(text, prediction)
        return prediction, False  # Fresh prediction
```

---

## 🔗 Integration Options

### 1. ServiceNow Integration

```python
import requests

class ServiceNowIntegration:
    def __init__(self, instance, username, password):
        self.base_url = f"https://{instance}.service-now.com/api/now"
        self.auth = (username, password)
    
    def create_ticket(self, title, description, category):
        url = f"{self.base_url}/table/incident"
        
        data = {
            "short_description": title,
            "description": description,
            "category": category,
            "assigned_to": self.get_assignment_group(category)
        }
        
        response = requests.post(url, json=data, auth=self.auth)
        return response.json()
    
    def get_assignment_group(self, category):
        # Logic to determine assignment based on category
        mapping = {
            "Server Management": "server_team",
            "Database Issue": "db_team",
            # ...
        }
        return mapping.get(category, "default_team")
```

### 2. Email Integration

```python
import imaplib
import email

class EmailTicketProcessor:
    def __init__(self, email_server, username, password):
        self.imap = imaplib.IMAP4_SSL(email_server)
        self.imap.login(username, password)
    
    def fetch_new_tickets(self):
        self.imap.select('INBOX')
        _, message_numbers = self.imap.search(None, 'UNSEEN')
        
        tickets = []
        for num in message_numbers[0].split():
            _, msg_data = self.imap.fetch(num, '(RFC822)')
            email_body = msg_data[0][1]
            email_message = email.message_from_bytes(email_body)
            
            tickets.append({
                'title': email_message['subject'],
                'description': self.get_email_body(email_message),
                'from': email_message['from']
            })
        
        return tickets
    
    def get_email_body(self, email_message):
        if email_message.is_multipart():
            for part in email_message.walk():
                if part.get_content_type() == "text/plain":
                    return part.get_payload(decode=True).decode()
        else:
            return email_message.get_payload(decode=True).decode()
```

### 3. Slack Bot Integration

```python
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

class SlackTicketBot:
    def __init__(self, token):
        self.client = WebClient(token=token)
        self.prediction_model = load_model()
    
    def handle_message(self, event):
        text = event['text']
        channel = event['channel']
        
        # Classify ticket
        category = self.prediction_model.predict([text])[0]
        
        # Send response
        self.send_message(
            channel,
            f"Ticket classified as: {category}\nWould you like to create a ticket?"
        )
    
    def send_message(self, channel, text):
        try:
            response = self.client.chat_postMessage(
                channel=channel,
                text=text
            )
        except SlackApiError as e:
            print(f"Error: {e.response['error']}")
```

---

## 📈 Metrics & Evaluation

### 1. Custom Metrics

```python
def calculate_business_impact(y_true, y_pred, priority_weights):
    """Calculate business impact score based on priorities"""
    correct_high_priority = np.sum(
        (y_true == 'High') & (y_pred == 'High')
    )
    total_high_priority = np.sum(y_true == 'High')
    
    return correct_high_priority / total_high_priority

def calculate_routing_accuracy(y_true, y_pred, routing_map):
    """Calculate if ticket would be routed to correct team"""
    true_teams = [routing_map[cat] for cat in y_true]
    pred_teams = [routing_map[cat] for cat in y_pred]
    
    return np.mean(np.array(true_teams) == np.array(pred_teams))
```

### 2. Cross-Validation Strategy

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

scores = cross_val_score(
    model,
    X,
    y,
    cv=cv,
    scoring='f1_weighted',
    n_jobs=-1
)

print(f"CV F1-Score: {scores.mean():.4f} (+/- {scores.std() * 2:.4f})")
```

---

## 🎯 Next Steps

1. **Start with Quick Wins**: Implement hyperparameter tuning and feature engineering
2. **Measure Impact**: Track metrics before and after each improvement
3. **Iterate**: Focus on the improvements that give the best ROI
4. **Monitor**: Set up monitoring and alerting for production
5. **Scale**: Optimize for larger datasets and real-time processing

---

**Happy Improving! 🚀**
