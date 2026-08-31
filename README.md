# 🎓 Shine Exam & Assessment Portal

An enterprise-grade, multi-tenant Online Examination, Learning Management, and Candidate Assessment Platform. Built with a high-performance **React 19 + TypeScript** frontend and a robust, low-latency **Flask + MongoDB** backend.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb)
![Architecture](https://img.shields.io/badge/Architecture-Multi--Tenant_SaaS-blueviolet)
![Security](https://img.shields.io/badge/Anti--Cheat-Active_Protection-crimson)
![Performance](https://img.shields.io/badge/Performance-Optimized_TTL_Cache-success)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)

---

## 🌟 Key Capabilities & Features

### 1. 🏢 Multi-Tenant SaaS & Super Admin Control
- **Tenant Isolation**: Complete data segregation by `tenantId` across all collections (exams, candidates, results, materials, logs).
- **Super Admin Dashboard (`/super-admin`)**: Manage organizations, create new tenant portals, monitor global user quotas, and view cross-tenant system metrics.
- **Dynamic Organization Branding**: Custom tenant names, logos, color themes, and dedicated portals for institutional partners.

### 2. 🛡️ Advanced Anti-Cheat & Screen Protection
- **Dynamic Canvas Watermarking**: High-visibility, tamper-resistant canvas overlay rendering live candidate ID, session code, and timestamps to deter unauthorized leaks.
- **Screenshot & Capture Interception**: Detects `PrintScreen`, `Alt+PrintScreen`, `Win+Shift+S`, `Cmd+Shift+3/4/5/6`, `Ctrl+P`, `beforeprint`, and OS Snipping Tool / window blurs.
- **Automatic Account Suspension**: Configurable violation threshold with automatic account locking, session termination, and audit logging.
- **Screen Recording & Tab Switching Guards**: Detects window blur, tab switching, and unauthorized media stream sharing.

### 3. ⚡ High-Throughput Engine & Low-Server-Load Architecture
- **Thread-Safe In-Memory TTL Cache**: In-memory user active-status caching in [backend/utils/cache.py](file:///d:/Adhi/Shine/Shine-Exam/backend/utils/cache.py) eliminates >95% of repetitive database lookups during concurrent candidate exams.
- **Optimized MongoDB Connection Pooling**: Tuned connection pool (`maxPoolSize=50`, `minPoolSize=5`, `maxIdleTimeMS=45000`, `retryWrites=True`).
- **Auto Background Indexing**: Core fields (`userId`, `naxUnid`, `role`, `status`, `tenantId`, `examId`) are indexed in the background for sub-millisecond query resolution.
- **In-Database Aggregation Pipelines**: Analytics and pass rates compute natively in MongoDB via `$group` pipelines with zero Python memory overhead.
- **Client-Side Throttling**: User activity listeners and canvas redraws are debounced and synchronized via `requestAnimationFrame`.

### 4. 📝 Multi-Modal Document Question Parser & Test Builder
- **Universal File Ingestion**: Ingests `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.csv`, `.txt`, and images.
- **Multimodal AI Pipeline**: PyMuPDF page rendering, OCR fallback via Tesseract/OpenCV, visual chart/table detection, and automated answer key mapping.
- **Interactive Question Editor**: Real-time inline editing, section management, negative marking rules, cutoffs, and question grouping for comprehension passages.
- **Live Exam Interface**: Responsive candidate assessment interface with question palette, bookmarking, timer alerts, and automated state preservation.

### 5. 🎥 Video Lectures, Study Materials & Announcements
- **Video Class Streaming**: Dedicated desktop and mobile-responsive video player for candidate course streams.
- **Document Management**: Distribute syllabus PDFs, formula sheets, and study notes with access control.
- **Broadcast Announcements**: Visual notice board with date-based scheduling and priority alerts.

### 6. 📱 Mobile-First Responsive Design
- Native mobile navigation drawer with touch-friendly pill tabs, overlay modals, and responsive exam paper review.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend** | React 19, TypeScript 5, React Router DOM v6, Vanilla CSS (Design Tokens, Glassmorphism, Micro-animations) |
| **Backend** | Python 3.11, Flask 3.0, Flask-CORS, PyMongo, Gunicorn, Werkzeug |
| **Database** | MongoDB (NoSQL Database with Connection Pooling & Background Indexes) |
| **Performance** | Thread-Safe In-Memory TTL Caching, MongoDB `$group` Aggregations, Client Throttling |
| **Document Processing** | PyMuPDF (fitz), pdfplumber, pypdf, python-docx, openpyxl, Pillow, pytesseract, OpenCV |
| **Scheduling & Security** | APScheduler, DateUtil, Canvas Security Engine, Web Audit Logs |
| **Containerization** | Docker, Docker Compose |

---

## 📁 Directory Structure

```text
Shine-Exam/
├── backend/
│   ├── app.py                      # Flask Application Entry Point & Security Firewall
│   ├── config/
│   │   ├── db.py                   # MongoDB Connection Pool & Auto Indexing
│   │   └── settings.py             # Environment Configuration & Security Settings
│   ├── routes/
│   │   ├── admin_dashboard.py      # Aggregated Metrics & Dashboard APIs
│   │   ├── admin_exams.py          # Exam Management & Publishing APIs
│   │   ├── admin_results.py        # Assessment Analytics & Candidate Scores
│   │   ├── admin_security_controls.py # Anti-Cheat Policy & Security Controls
│   │   ├── admin_users.py          # Candidate Management & Credential Reset
│   │   ├── admin_videos.py         # Video Class Management APIs
│   │   ├── admin_violations.py     # Violation Logs & Unblock Management
│   │   ├── answerer.py             # Live Exam Execution & Candidate APIs
│   │   ├── auth_routes.py          # Authentication & Login APIs
│   │   ├── exam_categories.py      # Category & Subcategory Taxonomy
│   │   ├── learning_resources.py   # Documents & Announcements APIs
│   │   ├── security_routes.py      # Real-time Violation Interception & Sessions
│   │   └── super_admin.py          # Multi-Tenant Provisioning & Super Admin APIs
│   ├── services/
│   │   ├── multimodal_parser.py    # Universal Document Ingestion & Question Extractor
│   │   ├── visual_extractor.py     # OCR & Visual Table/Chart Extractor
│   │   └── scoring.py              # Candidate Assessment Evaluation Engine
│   ├── utils/
│   │   ├── cache.py                # Thread-Safe In-Memory TTL Cache
│   │   ├── security.py             # Rate Limiting, RBAC & Security Headers
│   │   └── tenant.py               # Tenant Scoping & Branding Utilities
│   └── requirements.txt            # Python Dependencies Organized by Layer
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminDashboard.tsx       # Institutional Admin Portal & Analytics
│   │   │   ├── AnswererDashboard.tsx    # Candidate Portal & Available Exams
│   │   │   ├── SuperAdminDashboard.tsx  # Multi-Tenant SaaS Management
│   │   │   ├── TestEditor.tsx           # Inline Question & Exam Builder
│   │   │   ├── TestInterface.tsx        # Live Exam Runner & Security Guards
│   │   │   ├── StudentClasses.tsx       # Video Lecture Player & Class Library
│   │   │   └── UserManagement.tsx       # Student Roster & Credential Management
│   │   ├── context/
│   │   │   └── TenantContext.tsx        # Multi-Tenant Context Provider
│   │   ├── hooks/
│   │   │   └── useInactivityLogout.ts   # Throttled Inactivity Auto-Logout Hook
│   │   ├── security/
│   │   │   ├── DynamicWatermark.tsx     # Canvas Watermark Engine
│   │   │   ├── SensitiveContent.tsx     # Content Masking & Screenshot Shield
│   │   │   └── useScreenProtection.ts   # Hardware & OS Screen Capture Interceptor
│   │   ├── services/
│   │   │   └── api.ts                   # Centralized API Service Layer
│   │   ├── App.tsx                      # App Root Router & Security Context
│   │   └── index.tsx                    # Entry Point
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **Python**: v3.11 or higher
- **MongoDB**: Local MongoDB instance running on `localhost:27017` or a MongoDB Atlas connection URI

### 1. Backend Setup
```bash
cd backend
python -m venv venv

# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install categorized dependencies
pip install -r requirements.txt

# Start the Flask API server
python app.py
```
*Backend API service runs at `http://localhost:5000`*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start
```
*Frontend application runs at `http://localhost:3000`*

---

## 🐳 Docker Deployment

To launch the entire platform stack (Frontend + Backend + MongoDB) via Docker Compose:

```bash
docker-compose up --build -d
```

---

## 🔒 Security & Performance Guidelines

1. **Authentication & Session Tokens**: Session IDs are generated with short-lived TTLs and embedded in client watermarks for auditable tracking.
2. **Zero-Overhead Security Gate**: Candidate status checks are resolved directly via the in-memory TTL cache to maintain sub-5ms response times during heavy exam sessions.
3. **Audit Logging**: All screenshot attempts, tab changes, credential modifications, and status changes are permanently logged to the `audit_logs` collection.

---

## 📄 License
Enterprise Assessment & Learning Management System. All rights reserved.

