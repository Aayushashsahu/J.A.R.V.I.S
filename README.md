# J.A.R.V.I.S. — Industrial Knowledge Intelligence

> **The Unified Asset & Operations Brain**
> ET AI Hackathon 2026 · Problem Statement #8

![Architecture](docs/architecture/architecture.png)

**J.A.R.V.I.S.** transforms disconnected industrial documents into operational intelligence using Agentic AI, Knowledge Graphs, and Retrieval-Augmented Generation. Built for steel plants, oil refineries, power plants, chemical facilities, and manufacturing environments.

---

## 🏭 What It Does

| Capability | Description |
|------------|-------------|
| **Document Intelligence** | Ingest PDFs, DOCX, inspection forms, maintenance logs, SOPs, OEM manuals, P&IDs, work orders, and incident reports |
| **AI Copilot** | Ask questions like *"Why did Pump P-204 fail?"* or *"Show SOP for Boiler Startup"* — get cited answers |
| **Knowledge Graph** | Automatic entity extraction — equipment IDs, failure modes, regulations, maintenance events — with relationship mapping |
| **Compliance Tracking** | Monitor OSHA, EPA, ISO standards against your document corpus. Find gaps instantly |
| **Root Cause Analysis** | AI-powered RCA generation from maintenance logs, failure reports, and inspection data |
| **Operations Timeline** | Track every document ingestion, inspection update, and compliance event across all plants |
| **Hybrid Search** | Dense vector + BM25 keyword search with Reciprocal Rank Fusion for maximum recall |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                     │
│  Command Center · AI Copilot · Knowledge Graph · Timeline │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  API Gateway (FastAPI)                    │
│         Auth · Documents · Chat · Agent · Brain           │
└────────┬───────────────┬──────────────┬─────────────────┘
         │               │              │
┌────────▼──────┐ ┌──────▼──────┐ ┌────▼──────────┐
│  AI Agents    │ │  Vector DB  │ │ Knowledge     │
│  (LangGraph)  │ │  (Qdrant)   │ │ Graph (KG)    │
│               │ │             │ │               │
│  Document     │ │  768-dim    │ │  Equipment    │
│  Ingestion    │ │  embeddings │ │  Relations    │
│  RCA          │ │             │ │  Failure Modes│
│  Compliance   │ │             │ │  Regulations  │
└───────────────┘ └─────────────┘ └───────────────┘
         │               │              │
┌────────▼───────────────▼──────────────▼─────────────────┐
│              LLM Providers (Gemini / NVIDIA NIM)          │
│           Document Processing · Entity Extraction         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
# 1. Clone & configure
git clone https://github.com/Aayushashsahu/J.A.R.V.I.S.git
cd J.A.R.V.I.S
cp .env.example .env        # Add your NVIDIA_API_KEY (from build.nvidia.com) and JWT_SECRET_KEY

# 2. Start with Docker
docker compose up -d

# 3. Open
#    Frontend   http://localhost:3000
#    API Docs   http://localhost:8000/docs
```

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🤖 AI Agents

| Agent | Purpose |
|-------|---------|
| **Document Ingestion Agent** | Parse, chunk, embed, and index industrial documents |
| **Knowledge Graph Agent** | Extract entities and build equipment-maintenance-failure relationships |
| **RCA Agent** | Generate root cause analyses from maintenance logs and failure reports |
| **Compliance Agent** | Cross-reference documents against regulatory standards |
| **Search Agent** | Hybrid semantic + keyword retrieval with citation provenance |
| **Recommendation Agent** | Suggest maintenance actions, compliance fixes, and document improvements |

---

## 📊 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router) · TypeScript · Tailwind CSS |
| **Backend** | FastAPI · Python 3.11 · SQLAlchemy · Alembic |
| **Vector DB** | Qdrant v1.9 (768-dim vectors) |
| **Database** | PostgreSQL 15 / SQLite |
| **AI Engine** | NVIDIA NIM Embeddings · Gemini / NVIDIA LLMs |
| **Agent Framework** | LangGraph · LangChain |
| **Sidecar** | GBrain (Bun + PGLite · MCP Protocol) |

---

## 🔧 Features

### Document Types Supported
PDF · DOCX · Markdown · Text · Excel · CSV · Scanned Reports · P&IDs · Inspection Forms · Maintenance Logs · Incident Reports · Work Orders · SOPs · OEM Manuals · Quality Documents

### Entity Extraction
Equipment IDs · Asset Tags · Dates · Engineers · Departments · Plants · Risk Levels · Failure Modes · Regulations · Maintenance Events · Compliance Standards · Inspection Results

### Search Capabilities
- **Semantic Search** — Vector similarity over 768-dim embeddings
- **Hybrid Search** — BM25 + Dense + Reciprocal Rank Fusion
- **Metadata Filters** — By equipment, plant, date, document type
- **Citation Provenance** — Every answer traced to source document and page

---

## 📁 Repository Structure

```
backend/
  app/
    api/routers/      # Auth, documents, chat, agent, brain, timeline, HUD
    services/         # Document processor, Qdrant, LLM provider, retriever
    agents/           # LangGraph agent orchestration
    core/             # Config, security
    db/               # Models, sessions
frontend/
  app/                # Login, register, dashboard (Command Center, AI Copilot, KG, Timeline)
  components/         # UI components (shadcn/ui)
docs/
  architecture/       # Architecture diagrams
```

---

## 🎯 Demo Scenarios

1. **Equipment Failure Analysis** — Upload maintenance logs, ask *"Why did Pump P-204 fail?"*
2. **SOP Lookup** — Upload SOPs, ask *"Show me the Boiler Startup procedure"*
3. **Compliance Audit** — Upload regulatory documents, ask *"Show compliance gaps for OSHA 1910.119"*
4. **Maintenance History** — Upload work orders, ask *"What maintenance happened last month?"*
5. **Cross-Reference** — Ask *"Which documents reference Compressor C-102?"*
6. **Root Cause Analysis** — Ask *"Generate RCA for Heat Exchanger E-301 failure"*

---

## 📈 Future Scope

- **Real-time IoT Integration** — Connect to SCADA/DCS for live sensor data
- **Predictive Maintenance** — ML-based failure prediction from historical patterns
- **Multi-Plant Federation** — Cross-plant knowledge sharing with role-based access
- **Mobile Field Technician App** — Offline-first document access and inspection forms
- **Computer Vision** — P&ID parsing, equipment recognition, visual inspection analysis
- **Regulatory Auto-Update** — Monitor and flag regulatory changes affecting operations

---

## 🏆 Why This Wins

- **Immediate Value** — Any plant operator can upload documents and get intelligent answers in minutes
- **Production-Ready Architecture** — Not a demo — proper auth, multi-tenant isolation, streaming responses
- **Citation-First** — Every answer includes source provenance. Trust but verify.
- **Industrial Domain Focus** — Purpose-built for equipment IDs, failure modes, compliance standards
- **Hackathon-Speed, Enterprise-Quality** — Beautiful industrial dark-theme UI, full-stack working product

---

## 📄 License

MIT — See [`LICENSE`](./LICENSE)
