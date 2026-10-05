# 🚀 Quick Start Guide

Get up and running in 5 minutes!

## ⚡ Installation

### Windows
```cmd
# 1. Run setup
setup.bat

# 2. Activate environment
venv\Scripts\activate

# 3. Run pipeline
cd src
python main_pipeline.py --quick
```

### Linux/Mac
```bash
# 1. Run setup
chmod +x setup.sh
./setup.sh

# 2. Activate environment
source venv/bin/activate

# 3. Run pipeline
cd src
python main_pipeline.py --quick
```

## 📊 What You'll Get

After running the pipeline, you'll have:

✅ **Cleaned dataset** - Ready for analysis  
✅ **Trained ML models** - 3 models compared automatically  
✅ **TF-IDF vectorizer** - Text feature extraction  
✅ **Performance visualizations** - Model comparison charts  

## ⏱️ Timeline

- **Quick mode** (~3-5 minutes):
  - Data cleaning
  - ML model training
  - Basic evaluation

- **Full mode** (~10-15 minutes):
  - Everything in quick mode
  - Sentence embeddings
  - Semantic search index
  - RAG demo

## 🎯 Making Predictions

```python
import joblib

# Load models
model = joblib.load("../models/baseline/model.joblib")
vectorizer = joblib.load("../models/baseline/tfidf.joblib")
encoder = joblib.load("../models/baseline/label_encoder.joblib")

# Predict
text = "Server not responding"
features = vectorizer.transform([text])
prediction = model.predict(features)[0]
category = encoder.inverse_transform([prediction])[0]

print(f"Category: {category}")
```

## 🌐 Start API Server

```bash
cd scripts
python api_server.py
```

Visit `http://localhost:8000/docs` for interactive API documentation.

## 📖 Next Steps

1. Read the full [README.md](README.md)
2. Check [IMPROVEMENTS_GUIDE.md](IMPROVEMENTS_GUIDE.md) for customization
3. Explore the source code in `src/`
4. Try the API examples in the README

## ⚠️ Troubleshooting

**Issue**: Import errors  
**Fix**: Make sure virtual environment is activated

**Issue**: Models not found  
**Fix**: Run `python main_pipeline.py` first to generate models

**Issue**: Out of memory  
**Fix**: Use `--quick` mode or reduce batch size in `configs/config.py`

---

**Need help?** Check the full README or open an issue on GitHub.
