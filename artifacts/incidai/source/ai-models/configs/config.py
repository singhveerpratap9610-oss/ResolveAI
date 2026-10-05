"""
Configuration file for ITSM Ticket Classification Project
"""
import os
from pathlib import Path

# Project Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODELS_DIR = PROJECT_ROOT / "models"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"

# Data Files
RAW_TICKETS_FILE = RAW_DATA_DIR / "tickets.csv"
CLEAN_TICKETS_FILE = PROCESSED_DATA_DIR / "clean_tickets.csv"
TRAIN_FILE = PROCESSED_DATA_DIR / "train.csv"
TEST_FILE = PROCESSED_DATA_DIR / "test.csv"
VAL_FILE = PROCESSED_DATA_DIR / "val.csv"

# Model Paths
BASELINE_MODEL_PATH = MODELS_DIR / "baseline" / "model.joblib"
TFIDF_PATH = MODELS_DIR / "baseline" / "tfidf.joblib"
LABEL_ENCODER_PATH = MODELS_DIR / "baseline" / "label_encoder.joblib"
EMBEDDINGS_PATH = MODELS_DIR / "embeddings" / "sentence_embeddings.npy"
FAISS_INDEX_PATH = MODELS_DIR / "embeddings" / "faiss_index.bin"
DL_MODEL_PATH = MODELS_DIR / "dl" / "best_model.pt"

# Data Processing
ENCODING = 'latin1'
TEXT_COLUMNS = ['Title', 'Description']
TARGET_COLUMN = 'Service Category'  # Primary target
CLASSIFICATION_COLUMN = 'Classification'  # Secondary target
PRIORITY_COLUMN = 'Priority'
GROUP_COLUMN = 'Group'

# Feature Engineering
MAX_FEATURES = 5000
NGRAM_RANGE = (1, 2)
MIN_DF = 2
MAX_DF = 0.95

# Model Training
TEST_SIZE = 0.2
VAL_SIZE = 0.1
RANDOM_STATE = 42
STRATIFY = True

# ML Models Config
ML_MODELS = {
    'logistic_regression': {
        'max_iter': 1000,
        'random_state': RANDOM_STATE,
        'class_weight': 'balanced'
    },
    'random_forest': {
        'n_estimators': 100,
        'max_depth': 20,
        'random_state': RANDOM_STATE,
        'class_weight': 'balanced',
        'n_jobs': -1
    },
    'xgboost': {
        'n_estimators': 100,
        'max_depth': 10,
        'learning_rate': 0.1,
        'random_state': RANDOM_STATE
    }
}

# Deep Learning Config
DL_CONFIG = {
    'model_name': 'distilbert-base-uncased',
    'max_length': 128,
    'batch_size': 16,
    'num_epochs': 5,
    'learning_rate': 2e-5,
    'warmup_steps': 500,
    'weight_decay': 0.01
}

# Sentence Embeddings
EMBEDDING_MODEL = 'all-MiniLM-L6-v2'
EMBEDDING_BATCH_SIZE = 32

# LLM Configuration
LLM_CONFIG = {
    'model': 'gpt-3.5-turbo',
    'temperature': 0.3,
    'max_tokens': 500,
    'top_p': 0.9
}

# RAG Configuration
RAG_CONFIG = {
    'chunk_size': 500,
    'chunk_overlap': 50,
    'k_similar': 5,
    'score_threshold': 0.7
}

# Visualization
FIG_SIZE = (12, 8)
DPI = 100
STYLE = 'seaborn-v0_8-darkgrid'

# API Configuration
API_HOST = "0.0.0.0"
API_PORT = 8000

# Logging
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Environment Variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
WANDB_API_KEY = os.getenv("WANDB_API_KEY", "")
