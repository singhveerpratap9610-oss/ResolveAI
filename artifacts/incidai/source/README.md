# IncidAi 

<div align="center">

![IncidAi Logo](https://img.shields.io/badge/IncidAi-Intelligent%20IT%20Support-blueviolet?style=for-the-badge)

**Intelligent Incident Classification & Resolution System**

[![AI Powered](https://img.shields.io/badge/AI-Powered-brightgreen?style=flat-square)](https://github.com)
[![Django](https://img.shields.io/badge/Django-REST-092E20?style=flat-square&logo=django)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![XGBoost](https://img.shields.io/badge/ML-XGBoost-orange?style=flat-square)](https://xgboost.ai/)


*Transforming IT support operations with AI-driven automation*

**🏆 AI4Impact Hackathon 2026 Project**

[Demo](#-demo) • [Features](#-key-features) • [Installation](#-installation) • [Documentation](#-documentation) • [Team](#-team)

---

### 📱Learn More


https://incidai.vercel.app/



---

## 🎯 Problem Statement

IT support teams face **overwhelming inefficiencies** in managing incident tickets manually:

- ⏱️ **Manual IT ticket handling:** 15-20 min/ticket
- ❌ **25% misclassification rate**
- 📈 **Poor scalability** with growing ticket volumes
- 💰 **High operational costs**

## 💡 Our Solution

**IncidAi** is an intelligent incident classification and auto-resolution system that leverages cutting-edge AI to transform IT support operations, delivering:

- ✅ **89.3% classification accuracy** (from 72% manual baseline)
- ⚡ **187ms average response time** (99% faster than manual)
- 🎯 **73% automatic ticket resolution**
- 💰 **82% cost reduction** per ticket
- 🚀 **85% faster resolution times**

---

## ✨ Key Features

### 🤖 Hybrid AI Classification
- **XGBoost** for high accuracy predictions
- **BERT embeddings** for semantic understanding
- Real-time ticket categorization (Password, Email, VPN, Folder Access, etc.)

### 🔍 Intelligent Auto-Resolution
- **RAG (Retrieval-Augmented Generation)** retrieves similar past tickets
- Instant solution recommendations
- Knowledge base integration

### ⚡ Real-Time Processing
- Sub-200ms response time
- Production-grade architecture
- Scalable for thousands of daily tickets

### 🎨 Full-Stack Application
- Modern **React** frontend with Vite
- **Django REST** API backend
- **PostgreSQL** database
- Responsive and intuitive UI

---

## 🏗️ System Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   Backend   │─────▶│  Database   │
│ React + Vite│      │Django REST  │      │ PostgreSQL  │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  ML Models  │
                     │   XGBoost   │
                     └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │ RAG System  │
                     │FAISS + BERT │
                     └─────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Latest-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)

### Backend
![Django](https://img.shields.io/badge/Django-REST-092E20?style=flat-square&logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?style=flat-square&logo=postgresql&logoColor=white)

### AI/ML
![XGBoost](https://img.shields.io/badge/XGBoost-ML-orange?style=flat-square)
![BERT](https://img.shields.io/badge/BERT-NLP-red?style=flat-square)
![FAISS](https://img.shields.io/badge/FAISS-Vector%20Search-blue?style=flat-square)

---

## 📊 Performance Metrics

| Metric | Target | Achieved | Status |
|--------|--------|----------|--------|
| **Accuracy** | >90% | 89.3% | ⚠️ Near Target |
| **Response Time** | <2s | 187ms | ✅ Exceeded |
| **Cost Reduction** | - | 82% | ✅ Outstanding |

### 📈 Model Comparison

```
XGBoost        ████████████████████ 89%
Random Forest  ███████████████      78%
Logistic Reg   ██████████████       77%
Manual         █████████████        72%
```

### 📋 Category Distribution

- 🔐 Password: 28%
- 📁 Folder Access: 22%
- 📧 Email: 18%
- 🔒 VPN: 15%
- 🔧 Others: 17%

---

## 🚀 Installation

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/[YOUR-USERNAME]/incidai.git
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run migrations
python manage.py migrate

# Load initial data (optional)
python manage.py loaddata initial_data.json

# Start the backend server
python manage.py runserver
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Admin Panel: http://localhost:8000/admin

---
# IncidAI ML Server (`itsm_ml_project`)

This folder contains the machine learning model server built with **FastAPI**, which handles ITSM ticket classification, embeddings, and semantic search. It runs independently from the Django backend and can be accessed via API calls.

---

## Prerequisites

- Python 3.9+
- pip
- Optional: virtual environment tool (`venv`)

---

## Setup

1. **Navigate to the project folder**

```bash
cd itsm_ml_project
# Linux / macOS
python -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
# Option 1: Using the provided script
python scripts/api_server.py

# Option 2: Using Uvicorn directly
uvicorn src.api_server:app --reload --host 0.0.0.0 --port 8000
```
---


## 📖 Documentation

### API Endpoints

#### Ticket Classification
```http
POST /api/classify/
Content-Type: application/json

{
  "description": "I can't access my email account",
  "priority": "high"
}
```

#### Auto-Resolution
```http
POST /api/resolve/
Content-Type: application/json

{
  "ticket_id": "12345",
  "category": "email"
}
```

For complete API documentation, visit `/api/docs/` after starting the server.

---

## 🎯 Use Cases

1. **IT Service Desks**: Automate ticket triage and first-level support
2. **Enterprise Support**: Handle high-volume incident management
3. **MSPs**: Scale support operations efficiently
4. **Internal IT Teams**: Reduce workload on support staff

---

## 🗺️ Roadmap

### Phase 1 - Current ✅
- [x] Core AI classification system
- [x] RAG-based auto-resolution
- [x] Full-stack application
- [x] Real-time processing

### Phase 2 - Next Quarter 🚧
- [ ] 📱 **Mobile-First Experience**: Native iOS/Android apps
- [ ] 🌍 **Global Scale**: Multi-language support
- [ ] 📊 **Advanced Analytics Dashboard**
- [ ] 🔗 **Enterprise Integrations**: ServiceNow, Jira, etc.

### Phase 3 - Future Vision 🔮
- [ ] **Predictive Intelligence**: Anticipate issues before reporting
- [ ] **Custom LLM**: Domain-specific language model
- [ ] **Voice-to-Ticket**: Voice interface for ticket creation
- [ ] **Auto-Resolution**: Fully autonomous issue resolution

---

## 📊 Business Impact

### Measurable Outcomes

| Impact Area | Improvement |
|-------------|-------------|
| 💰 **Cost Savings** | 82% reduction per ticket |
| ⏱️ **Resolution Time** | 85% faster (hours → minutes) |
| 📈 **Accuracy** | +17 points (72% → 89%) |




## 👥 Team

**Neuralx** @ ENSAM Casablanca

- **Kazoury Chaimae** 
- **Fatima-Ezzahra Lagdem** 
- **Lina Benlakhbaizi**

**Built for AI4Impact Hackathon 2026** 🏆

---

## 📚 References

1. **ITSM Dataset** - Real-world incident tickets
2. **Django REST Framework** - Backend API
3. **Sentence-BERT** (Reimers & Gurevych, 2019) - Text embeddings
4. **FAISS** (Facebook AI) - Vector similarity search
5. **XGBoost** (Chen & Guestrin, 2016) - Gradient boosting
6. **RAG** (Lewis et al., 2020) - Retrieval-augmented generation

---




## 🙏 Acknowledgments

- **Spring School AI4Impact** for organizing the hackathon
- **Open-source community** for amazing tools and libraries

---

## 📞 Contact

- **Project Link**: https://github.com/AgorAI-Hackathon/IncidAI
- **Email**: chaimaekaz05@gmail.com && fatima.ezzahra.lag@gmail.com
- **LinkedIn**: https://www.linkedin.com/in/chaimae-kazoury-040715238/ && www.linkedin.com/in/lagdem-fatima-e 

---

<div align="center">

### ⭐ Star us on GitHub — it motivates us a lot!

**Made with ❤️ by Neuralx Team**


</div>
