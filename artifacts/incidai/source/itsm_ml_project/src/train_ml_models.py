"""
Baseline Machine Learning Models
Implements multiple ML algorithms for ticket classification
"""
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from typing import Dict, Tuple
import sys
sys.path.append(str(Path(__file__).parent.parent))
from configs.config import *

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report, 
    accuracy_score, 
    f1_score,
    confusion_matrix
)
import matplotlib.pyplot as plt
import seaborn as sns

class BaselineMLPipeline:
    """Train and evaluate baseline ML models"""
    
    def __init__(self):
        self.vectorizer = None
        self.label_encoder = None
        self.models = {}
        self.results = {}
        
    def load_data(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Load train, val, and test datasets"""
        print("Loading datasets...")
        train = pd.read_csv(TRAIN_FILE)
        val = pd.read_csv(VAL_FILE)
        test = pd.read_csv(TEST_FILE)
        return train, val, test
    
    def build_features(self, train_texts, test_texts=None):
        """Build TF-IDF features"""
        print("\n=== Building TF-IDF Features ===")
        
        self.vectorizer = TfidfVectorizer(
            max_features=MAX_FEATURES,
            ngram_range=NGRAM_RANGE,
            min_df=MIN_DF,
            max_df=MAX_DF,
            sublinear_tf=True
        )
        
        X_train = self.vectorizer.fit_transform(train_texts)
        print(f"Feature matrix shape: {X_train.shape}")
        print(f"Vocabulary size: {len(self.vectorizer.vocabulary_)}")
        
        # Save vectorizer
        TFIDF_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.vectorizer, TFIDF_PATH)
        print(f"✓ Saved TF-IDF vectorizer to {TFIDF_PATH}")
        
        if test_texts is not None:
            X_test = self.vectorizer.transform(test_texts)
            return X_train, X_test
        
        return X_train
    
    def encode_labels(self, y_train, y_test=None):
        """Encode target labels"""
        self.label_encoder = LabelEncoder()
        y_train_encoded = self.label_encoder.fit_transform(y_train)
        
        # Save label encoder
        joblib.dump(self.label_encoder, LABEL_ENCODER_PATH)
        print(f"✓ Saved label encoder to {LABEL_ENCODER_PATH}")
        
        if y_test is not None:
            y_test_encoded = self.label_encoder.transform(y_test)
            return y_train_encoded, y_test_encoded
        
        return y_train_encoded
    
    def train_logistic_regression(self, X_train, y_train, X_val, y_val):
        """Train Logistic Regression model"""
        print("\n=== Training Logistic Regression ===")
        
        model = LogisticRegression(**ML_MODELS['logistic_regression'])
        model.fit(X_train, y_train)
        
        # Evaluate
        train_acc = accuracy_score(y_train, model.predict(X_train))
        val_acc = accuracy_score(y_val, model.predict(X_val))
        val_f1 = f1_score(y_val, model.predict(X_val), average='weighted')
        
        print(f"Train Accuracy: {train_acc:.4f}")
        print(f"Val Accuracy: {val_acc:.4f}")
        print(f"Val F1-Score: {val_f1:.4f}")
        
        self.models['logistic_regression'] = model
        self.results['logistic_regression'] = {
            'train_acc': train_acc,
            'val_acc': val_acc,
            'val_f1': val_f1
        }
        
        return model
    
    def train_random_forest(self, X_train, y_train, X_val, y_val):
        """Train Random Forest model"""
        print("\n=== Training Random Forest ===")
        
        model = RandomForestClassifier(**ML_MODELS['random_forest'])
        model.fit(X_train, y_train)
        
        # Evaluate
        train_acc = accuracy_score(y_train, model.predict(X_train))
        val_acc = accuracy_score(y_val, model.predict(X_val))
        val_f1 = f1_score(y_val, model.predict(X_val), average='weighted')
        
        print(f"Train Accuracy: {train_acc:.4f}")
        print(f"Val Accuracy: {val_acc:.4f}")
        print(f"Val F1-Score: {val_f1:.4f}")
        
        self.models['random_forest'] = model
        self.results['random_forest'] = {
            'train_acc': train_acc,
            'val_acc': val_acc,
            'val_f1': val_f1
        }
        
        return model
    
    def train_xgboost(self, X_train, y_train, X_val, y_val):
        """Train XGBoost model"""
        print("\n=== Training XGBoost ===")
        
        try:
            from xgboost import XGBClassifier
            
            model = XGBClassifier(**ML_MODELS['xgboost'])
            model.fit(X_train, y_train)
            
            # Evaluate
            train_acc = accuracy_score(y_train, model.predict(X_train))
            val_acc = accuracy_score(y_val, model.predict(X_val))
            val_f1 = f1_score(y_val, model.predict(X_val), average='weighted')
            
            print(f"Train Accuracy: {train_acc:.4f}")
            print(f"Val Accuracy: {val_acc:.4f}")
            print(f"Val F1-Score: {val_f1:.4f}")
            
            self.models['xgboost'] = model
            self.results['xgboost'] = {
                'train_acc': train_acc,
                'val_acc': val_acc,
                'val_f1': val_f1
            }
            
            return model
        except ImportError:
            print("XGBoost not installed. Skipping...")
            return None
    
    def evaluate_test_set(self, X_test, y_test):
        """Evaluate all models on test set"""
        print("\n" + "=" * 50)
        print("FINAL TEST SET EVALUATION")
        print("=" * 50)
        
        test_results = {}
        
        for name, model in self.models.items():
            y_pred = model.predict(X_test)
            
            acc = accuracy_score(y_test, y_pred)
            f1 = f1_score(y_test, y_pred, average='weighted')
            
            print(f"\n{name.upper()}:")
            print(f"  Accuracy: {acc:.4f}")
            print(f"  F1-Score: {f1:.4f}")
            
            test_results[name] = {
                'accuracy': acc,
                'f1_score': f1,
                'predictions': y_pred
            }
        
        return test_results
    
    def save_best_model(self):
        """Save the best performing model"""
        # Find best model based on validation F1 score
        best_model_name = max(
            self.results.items(),
            key=lambda x: x[1]['val_f1']
        )[0]
        
        best_model = self.models[best_model_name]
        
        # Save model
        joblib.dump(best_model, BASELINE_MODEL_PATH)
        print(f"\n✓ Saved best model ({best_model_name}) to {BASELINE_MODEL_PATH}")
        
        # Save model metadata
        metadata = {
            'model_type': best_model_name,
            'val_accuracy': self.results[best_model_name]['val_acc'],
            'val_f1': self.results[best_model_name]['val_f1'],
            'num_classes': len(self.label_encoder.classes_),
            'classes': self.label_encoder.classes_.tolist()
        }
        
        import json
        metadata_path = BASELINE_MODEL_PATH.parent / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"✓ Saved metadata to {metadata_path}")
        
        return best_model_name
    
    def plot_results(self, test_results):
        """Plot model comparison"""
        print("\n=== Generating Visualizations ===")
        
        # Prepare data for plotting
        models = list(test_results.keys())
        accuracies = [test_results[m]['accuracy'] for m in models]
        f1_scores = [test_results[m]['f1_score'] for m in models]
        
        # Create comparison plot
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        # Accuracy comparison
        axes[0].bar(models, accuracies, color='skyblue', edgecolor='navy')
        axes[0].set_ylabel('Accuracy')
        axes[0].set_title('Model Accuracy Comparison')
        axes[0].set_ylim([0, 1])
        for i, v in enumerate(accuracies):
            axes[0].text(i, v + 0.02, f'{v:.3f}', ha='center', fontweight='bold')
        
        # F1-Score comparison
        axes[1].bar(models, f1_scores, color='lightcoral', edgecolor='darkred')
        axes[1].set_ylabel('F1-Score (Weighted)')
        axes[1].set_title('Model F1-Score Comparison')
        axes[1].set_ylim([0, 1])
        for i, v in enumerate(f1_scores):
            axes[1].text(i, v + 0.02, f'{v:.3f}', ha='center', fontweight='bold')
        
        plt.tight_layout()
        
        # Save plot
        output_path = OUTPUTS_DIR / "visualizations" / "ml_model_comparison.png"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_path, dpi=DPI, bbox_inches='tight')
        print(f"✓ Saved comparison plot to {output_path}")
        plt.close()
    
    def run_pipeline(self):
        """Run complete ML pipeline"""
        print("=" * 50)
        print("BASELINE ML TRAINING PIPELINE")
        print("=" * 50)
        
        # Load data
        train, val, test = self.load_data()
        
        # Build features
        X_train = self.build_features(train['clean_text'])
        X_val = self.vectorizer.transform(val['clean_text'])
        X_test = self.vectorizer.transform(test['clean_text'])
        
        # Encode labels
        y_train = self.encode_labels(train[TARGET_COLUMN])
        y_val = self.label_encoder.transform(val[TARGET_COLUMN])
        y_test = self.label_encoder.transform(test[TARGET_COLUMN])
        
        # Train models
        self.train_logistic_regression(X_train, y_train, X_val, y_val)
        self.train_random_forest(X_train, y_train, X_val, y_val)
        self.train_xgboost(X_train, y_train, X_val, y_val)
        
        # Evaluate on test set
        test_results = self.evaluate_test_set(X_test, y_test)
        
        # Save best model
        best_model = self.save_best_model()
        
        # Plot results
        self.plot_results(test_results)
        
        print("\n" + "=" * 50)
        print("✓ BASELINE ML TRAINING COMPLETE")
        print("=" * 50)

if __name__ == "__main__":
    pipeline = BaselineMLPipeline()
    pipeline.run_pipeline()
