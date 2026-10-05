"""
Deep Learning Models using Transformers
Implements fine-tuned transformer models for ticket classification
"""
import pandas as pd
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EvalPrediction
)
from sklearn.metrics import accuracy_score, f1_score, classification_report
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from configs.config import *
import json

class TicketDataset(Dataset):
    """Custom Dataset for ITSM tickets"""
    
    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.texts)
    
    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]
        
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

class DeepLearningPipeline:
    """Train transformer models for ticket classification"""
    
    def __init__(self, model_name=None):
        self.model_name = model_name or DL_CONFIG['model_name']
        self.tokenizer = None
        self.model = None
        self.label_map = {}
        self.id2label = {}
        self.label2id = {}
        
    def load_data(self):
        """Load train, val, and test datasets"""
        print("Loading datasets...")
        train = pd.read_csv(TRAIN_FILE)
        val = pd.read_csv(VAL_FILE)
        test = pd.read_csv(TEST_FILE)
        return train, val, test
    
    def prepare_labels(self, train_df):
        """Create label mappings"""
        unique_labels = sorted(train_df[TARGET_COLUMN].unique())
        self.label2id = {label: idx for idx, label in enumerate(unique_labels)}
        self.id2label = {idx: label for label, idx in self.label2id.items()}
        
        print(f"\n=== Label Mapping ===")
        print(f"Number of classes: {len(unique_labels)}")
        print(f"Classes: {unique_labels[:5]}..." if len(unique_labels) > 5 else f"Classes: {unique_labels}")
        
        return unique_labels
    
    def create_datasets(self, train, val, test):
        """Create PyTorch datasets"""
        print("\n=== Creating PyTorch Datasets ===")
        
        # Initialize tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        
        # Convert labels to IDs
        train_labels = [self.label2id[label] for label in train[TARGET_COLUMN]]
        val_labels = [self.label2id[label] for label in val[TARGET_COLUMN]]
        test_labels = [self.label2id[label] for label in test[TARGET_COLUMN]]
        
        # Create datasets
        train_dataset = TicketDataset(
            train['clean_text'].tolist(),
            train_labels,
            self.tokenizer,
            DL_CONFIG['max_length']
        )
        
        val_dataset = TicketDataset(
            val['clean_text'].tolist(),
            val_labels,
            self.tokenizer,
            DL_CONFIG['max_length']
        )
        
        test_dataset = TicketDataset(
            test['clean_text'].tolist(),
            test_labels,
            self.tokenizer,
            DL_CONFIG['max_length']
        )
        
        print(f"Train dataset: {len(train_dataset)} samples")
        print(f"Val dataset: {len(val_dataset)} samples")
        print(f"Test dataset: {len(test_dataset)} samples")
        
        return train_dataset, val_dataset, test_dataset
    
    def compute_metrics(self, pred: EvalPrediction):
        """Compute evaluation metrics"""
        labels = pred.label_ids
        preds = pred.predictions.argmax(-1)
        
        acc = accuracy_score(labels, preds)
        f1 = f1_score(labels, preds, average='weighted')
        
        return {
            'accuracy': acc,
            'f1': f1
        }
    
    def train_model(self, train_dataset, val_dataset):
        """Train the transformer model"""
        print("\n=== Training Transformer Model ===")
        print(f"Model: {self.model_name}")
        
        # Initialize model
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_name,
            num_labels=len(self.label2id),
            id2label=self.id2label,
            label2id=self.label2id
        )
        
        # Training arguments
        output_dir = MODELS_DIR / "dl" / "checkpoints"
        training_args = TrainingArguments(
            output_dir=str(output_dir),
            num_train_epochs=DL_CONFIG['num_epochs'],
            per_device_train_batch_size=DL_CONFIG['batch_size'],
            per_device_eval_batch_size=DL_CONFIG['batch_size'],
            warmup_steps=DL_CONFIG['warmup_steps'],
            weight_decay=DL_CONFIG['weight_decay'],
            learning_rate=DL_CONFIG['learning_rate'],
            logging_dir=str(OUTPUTS_DIR / "logs"),
            logging_steps=100,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="f1",
            greater_is_better=True,
            save_total_limit=2,
            report_to="none"
        )
        
        # Initialize trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            compute_metrics=self.compute_metrics
        )
        
        # Train
        print("\nStarting training...")
        trainer.train()
        
        # Save best model
        self.model.save_pretrained(MODELS_DIR / "dl" / "best_model")
        self.tokenizer.save_pretrained(MODELS_DIR / "dl" / "best_model")
        
        print(f"✓ Model saved to {MODELS_DIR / 'dl' / 'best_model'}")
        
        return trainer
    
    def evaluate_model(self, trainer, test_dataset):
        """Evaluate model on test set"""
        print("\n=== Evaluating on Test Set ===")
        
        results = trainer.evaluate(test_dataset)
        
        print(f"\nTest Results:")
        print(f"  Accuracy: {results['eval_accuracy']:.4f}")
        print(f"  F1-Score: {results['eval_f1']:.4f}")
        print(f"  Loss: {results['eval_loss']:.4f}")
        
        # Save results
        results_path = OUTPUTS_DIR / "reports" / "dl_results.json"
        results_path.parent.mkdir(parents=True, exist_ok=True)
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"✓ Results saved to {results_path}")
        
        return results
    
    def predict_samples(self, test_dataset, num_samples=5):
        """Make predictions on sample data"""
        print("\n=== Sample Predictions ===")
        
        self.model.eval()
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(device)
        
        for i in range(min(num_samples, len(test_dataset))):
            sample = test_dataset[i]
            
            input_ids = sample['input_ids'].unsqueeze(0).to(device)
            attention_mask = sample['attention_mask'].unsqueeze(0).to(device)
            
            with torch.no_grad():
                outputs = self.model(input_ids, attention_mask=attention_mask)
                prediction = outputs.logits.argmax(-1).item()
            
            true_label = self.id2label[sample['labels'].item()]
            pred_label = self.id2label[prediction]
            
            print(f"\nSample {i+1}:")
            print(f"  True: {true_label}")
            print(f"  Predicted: {pred_label}")
            print(f"  Correct: {'✓' if true_label == pred_label else '✗'}")
    
    def run_pipeline(self):
        """Run complete DL pipeline"""
        print("=" * 50)
        print("DEEP LEARNING TRAINING PIPELINE")
        print("=" * 50)
        
        # Check for GPU
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"\nDevice: {device}")
        
        # Load data
        train, val, test = self.load_data()
        
        # Prepare labels
        self.prepare_labels(train)
        
        # Create datasets
        train_dataset, val_dataset, test_dataset = self.create_datasets(train, val, test)
        
        # Train model
        trainer = self.train_model(train_dataset, val_dataset)
        
        # Evaluate
        results = self.evaluate_model(trainer, test_dataset)
        
        # Sample predictions
        self.predict_samples(test_dataset)
        
        print("\n" + "=" * 50)
        print("✓ DEEP LEARNING TRAINING COMPLETE")
        print("=" * 50)
        
        return results

if __name__ == "__main__":
    pipeline = DeepLearningPipeline()
    pipeline.run_pipeline()
