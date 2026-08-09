# 🎓 Shine Exam & Assessment Portal

A state-of-the-art, enterprise-grade Online Examination, Learning Resources, and Candidate Assessment Platform. Engineered with a high-performance **React 19 + TypeScript** frontend and a robust **Flask + MongoDB** backend.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Flask](https://img.shields.io/badge/Flask-Python-black?logo=flask)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)
![Status](https://img.shields.io/badge/Status-Production_Ready-success)
![Design](https://img.shields.io/badge/UI_Design-Glassmorphism_%26_Gradients-blueviolet)

---

## 🌟 Key Capabilities & Features

### 1. 📝 Assessment Engine & Test Management
- **Timed Online Examinations**: Support for Single Choice (MCQ), Multi-Select Answers, and Text/Essay questions with custom score rules and cutoffs.
- **Interrupted Attempt Resume & Auto-Save**: Candidate test state is preserved automatically across network drops or session restarts.
- **Hierarchical Categorization**: Organize tests by **Category → Subcategory → Stage** (e.g., Banking → SBI Clerk → Prelims/Mains).
- **In-Place Inline Question Editor**: Real-time inline editing of questions within test sections with smooth auto-scroll into view.
- **AI / Automated Document Question Parser**: Upload PDF, Word DOCX, TXT, Excel XLSX/CSV, or JSON documents to automatically parse questions, options, and correct answers into the test bank.

### 2. 📊 Interactive Test Analytics & Insights
- **Test-wise Analytics Cards**: Interactive KPI cards featuring Live Data badges, attempt counts, average scores, and pass rates.
- **Score Distribution Charts**: Interactive score band filtering and overall performance analytics.
- **Candidate Top Performers**: Real-time leaderboards and performance breakdown per test paper.

### 3. 👥 Student & User Management
- **Student KPI Dashboard**: Multi-colored gradient cards tracking Total Students, Active Users, Blocked Users, and Total Attempts.
- **Advanced Filtering & Value-Help Inputs**: Instant search by name, username, email, active state, and date ranges.
- **Bulk Test Assignment**: Assign tests to individual candidates or bulk-select with a single click in a glassmorphism modal dialog.

### 4. 📢 Announcements & Learning Resources
- **Candidate Announcements Portal**: Visual announcement cards with color-coded accent stripes, date badges, banner image attachments, and outbound links.
- **Document Management**: Upload and distribute study materials, formula sheets, and practice PDFs to assigned candidate groups.
- **Scheduled Publishing**: Publish notices immediately or schedule automated future activation and expiration dates.

### 5. 🎨 Modern Design System
- **Vivid Full-Gradient Fills**: High-contrast, vibrant gradient card designs with subtle shimmer overlays and deep hover lifts.
- **Glassmorphism & Micro-Animations**: Modern typography (Inter, Outfit, Plus Jakarta Sans), sleek borders, rounded pill badges, and fluid state transitions.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend** | React 19, TypeScript 5, React Router DOM v6, Vanilla CSS (Design Tokens & Glassmorphism) |
| **Backend** | Python 3.11, Flask, Flask-CORS, PyMongo, Gunicorn |
| **Database** | MongoDB (NoSQL Database) |
| **Scheduling** | APScheduler, DateUtil |
| **Document Processing** | PyPDF2, python-docx, openpyxl, LibreOffice PDF Engine |
| **Containerization** | Docker, Docker Compose |

---

## 📁 Directory Structure

```text
Shine-Exam/
├── backend/
│   ├── app.py                      # Flask Application Entry Point
│   ├── routes/
│   │   ├── admin_users.py          # Candidate Management APIs
│   │   ├── auth_routes.py          # Authentication & Profile APIs
│   │   ├── exam_categories.py      # Category & Subcategory APIs
│   │   ├── learning_resources.py   # Announcements & Document APIs
│   │   ├── test_builder_routes.py  # Test Creation & Question Bank APIs
│   │   └── test_routes.py          # Test Execution & Result Evaluation APIs
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminDashboard.tsx       # Main Admin Overview & KPIs
│   │   │   ├── AnnouncementManagement.tsx # Admin Notice Composer
│   │   │   ├── AnswererDashboard.tsx    # Candidate Portal & Tests List
│   │   │   ├── CandidateResources.tsx   # Candidate Learning Materials & Announcements
│   │   │   ├── DocumentManagement.tsx   # Study Material Manager
│   │   │   ├── DocumentQuestionUploader.tsx # AI Question Parser Component
│   │   │   ├── ExamCategoryManagement.tsx # Exam Structure Manager
│   │   │   ├── TestBuilder.tsx          # New Test Creator
│   │   │   ├── TestEditor.tsx           # Test & Question Editor
│   │   │   ├── TestInterface.tsx        # Live Candidate Exam Interface
│   │   │   ├── TestList.tsx             # All Tests View & Assign Modal
│   │   │   ├── TestResults.tsx          # Interactive Analytics Dashboard
│   │   │   └── UserManagement.tsx       # Student Management Table
│   │   ├── App.css / App.tsx
│   │   └── index.tsx
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **Python**: v3.11 or higher
- **MongoDB**: Local MongoDB instance running on `localhost:27017` or MongoDB Atlas URI

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```
*Backend server runs on `http://localhost:5000`*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start
```
*Frontend application runs on `http://localhost:3000`*

---

## 🐳 Docker Deployment

To run the full Shine Exam Portal stack using Docker Compose:

```bash
docker-compose up --build -d
```

---

## 📄 License

Developed for enterprise assessment, learning management, and candidate evaluation workflows.
