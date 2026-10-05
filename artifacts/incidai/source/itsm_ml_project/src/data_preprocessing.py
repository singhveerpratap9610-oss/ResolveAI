"""
Data Cleaning and Preprocessing Module
Handles text cleaning, feature engineering, and data splitting
"""
import re
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Tuple, Optional
import sys
sys.path.append(str(Path(__file__).parent.parent))
from configs.config import *

class DataCleaner:
    """Clean and preprocess ITSM ticket data"""
    
    def __init__(self, input_path: str = None, output_path: str = None):
        self.input_path = input_path or RAW_TICKETS_FILE
        self.output_path = output_path or CLEAN_TICKETS_FILE
        
    @staticmethod
    def clean_text(text: str) -> str:
        """
        Clean and normalize text data
        
        Steps:
        1. Convert to lowercase
        2. Remove URLs
        3. Remove email addresses
        4. Remove IP addresses
        5. Remove special characters (keep alphanumeric and spaces)
        6. Remove extra whitespace
        """
        if pd.isna(text):
            return ""
        
        text = str(text).lower()
        
        # Remove URLs
        text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
        
        # Remove email addresses
        text = re.sub(r'\S+@\S+', '', text)
        
        # Remove IP addresses
        text = re.sub(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '', text)
        
        # Remove special characters but keep spaces
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def load_data(self) -> pd.DataFrame:
        """Load raw ticket data"""
        print(f"Loading data from {self.input_path}...")
        df = pd.read_csv(self.input_path, encoding=ENCODING)
        print(f"Loaded {len(df)} tickets with {len(df.columns)} columns")
        return df
    
    def clean_dataset(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean entire dataset"""
        print("\n=== Data Cleaning ===")
        initial_rows = len(df)
        
        # Create combined text field
        print("Combining Title and Description...")
        df['combined_text'] = (
            df['Title'].fillna('') + ' ' + 
            df['Description'].fillna('')
        )
        
        # Clean the combined text
        print("Cleaning text data...")
        df['clean_text'] = df['combined_text'].apply(self.clean_text)
        
        # Remove rows with empty clean_text or missing target
        print("Removing invalid rows...")
        df = df[df['clean_text'].str.len() > 0].copy()
        df = df.dropna(subset=[TARGET_COLUMN])
        
        # Filter out rare categories (less than 10 occurrences)
        print("Filtering rare categories...")
        category_counts = df[TARGET_COLUMN].value_counts()
        valid_categories = category_counts[category_counts >= 10].index
        df = df[df[TARGET_COLUMN].isin(valid_categories)].copy()
        
        print(f"Removed {initial_rows - len(df)} rows")
        print(f"Final dataset: {len(df)} rows")
        print(f"Number of categories: {df[TARGET_COLUMN].nunique()}")
        
        return df
    
    def add_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add engineered features"""
        print("\n=== Feature Engineering ===")
        
        # Text length features
        df['text_length'] = df['clean_text'].str.len()
        df['word_count'] = df['clean_text'].str.split().str.len()
        
        # Title features
        df['title_length'] = df['Title'].fillna('').str.len()
        df['has_description'] = (~df['Description'].isna()).astype(int)
        
        # Time-based features
        if 'Open DateTime' in df.columns:
            df['Open DateTime'] = pd.to_datetime(df['Open DateTime'], errors='coerce')
            df['hour'] = df['Open DateTime'].dt.hour
            df['day_of_week'] = df['Open DateTime'].dt.dayofweek
            df['month'] = df['Open DateTime'].dt.month
        
        # Priority encoding
        if PRIORITY_COLUMN in df.columns:
            priority_map = {'High': 3, 'Medium': 2, 'Low': 1}
            df['priority_encoded'] = df[PRIORITY_COLUMN].map(priority_map).fillna(2)
        
        print(f"Added {7} engineered features")
        return df
    
    def save_data(self, df: pd.DataFrame) -> None:
        """Save cleaned data"""
        print(f"\nSaving cleaned data to {self.output_path}...")
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(self.output_path, index=False)
        print("✓ Data saved successfully")
    
    def run_pipeline(self) -> pd.DataFrame:
        """Run complete data cleaning pipeline"""
        print("=" * 50)
        print("ITSM TICKET DATA CLEANING PIPELINE")
        print("=" * 50)
        
        df = self.load_data()
        df = self.clean_dataset(df)
        df = self.add_features(df)
        self.save_data(df)
        
        # Print summary statistics
        print("\n=== Data Summary ===")
        print(f"Total tickets: {len(df)}")
        print(f"\nTarget distribution ({TARGET_COLUMN}):")
        print(df[TARGET_COLUMN].value_counts().head(10))
        print(f"\nText statistics:")
        print(f"  Average length: {df['text_length'].mean():.0f} chars")
        print(f"  Average words: {df['word_count'].mean():.0f} words")
        
        return df

def split_dataset(
    input_path: str = None,
    test_size: float = TEST_SIZE,
    val_size: float = VAL_SIZE,
    random_state: int = RANDOM_STATE
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split dataset into train, validation, and test sets"""
    from sklearn.model_selection import train_test_split
    
    input_path = input_path or CLEAN_TICKETS_FILE
    print("\n=== Splitting Dataset ===")
    print(f"Loading data from {input_path}...")
    
    df = pd.read_csv(input_path)
    
    # First split: train+val vs test
    train_val, test = train_test_split(
        df,
        test_size=test_size,
        random_state=random_state,
        stratify=df[TARGET_COLUMN] if STRATIFY else None
    )
    
    # Second split: train vs val
    val_ratio = val_size / (1 - test_size)
    train, val = train_test_split(
        train_val,
        test_size=val_ratio,
        random_state=random_state,
        stratify=train_val[TARGET_COLUMN] if STRATIFY else None
    )
    
    # Save splits
    train.to_csv(TRAIN_FILE, index=False)
    val.to_csv(VAL_FILE, index=False)
    test.to_csv(TEST_FILE, index=False)
    
    print(f"Train set: {len(train)} samples ({len(train)/len(df)*100:.1f}%)")
    print(f"Val set: {len(val)} samples ({len(val)/len(df)*100:.1f}%)")
    print(f"Test set: {len(test)} samples ({len(test)/len(df)*100:.1f}%)")
    print("✓ Datasets saved")
    
    return train, val, test

if __name__ == "__main__":
    # Run data cleaning
    cleaner = DataCleaner()
    df = cleaner.run_pipeline()
    
    # Split dataset
    train, val, test = split_dataset()
