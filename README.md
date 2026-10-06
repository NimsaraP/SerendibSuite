# 📸 SerendibSuite

<div align="center">

![SerendibSuite Banner](https://img.shields.io/badge/SerendibSuite-Photography%20Workflow%20Platform-4f46e5?style=for-the-badge&logo=camera)

**AI-Assisted Workflow & Intelligent Culling Platform for Solo & Small-Team Event Photographers**

[![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-5.0-5C3EE8?style=flat-square&logo=opencv&logoColor=white)](https://opencv.org)
[![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20MySQL-orange?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com)
[![Status](https://img.shields.io/badge/Status-Gate%202%20%2B%20AI%20Milestones%20Complete-success?style=flat-square)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile%20Responsive-brightgreen?style=flat-square)]()

[Features](#-core-features) • [Architecture](#-system-architecture) • [AI Pipeline](#-ai-assisted-photo-analysis-pipeline) • [Quick Start](#-getting-started) • [API Reference](#-api-endpoints) • [Roadmap](#-roadmap)

---

</div>

## 📖 Executive Summary & Problem Domain

> **One-Line Problem:** Solo and small-team event photographers in Sri Lanka lose hours per event to disconnected booking tools and manual photo culling, with no unified, AI-assisted workflow built for their scale.

### The Pain Point
Event photographers covering weddings, corporate galas, and conferences typically run their client bookings through WhatsApp threads, manual spreadsheets, and external hard drives. After a shoot, they spend **3 to 6 hours** manually sorting through 100–300+ raw frames before creative editing can even begin. 

**SerendibSuite** solves this by unifying:
1. **Client & Booking Management** with strict field validations.
2. **Event Workspaces** with smart chronological scheduling.
3. **AI-Assisted Culling Pipeline** detecting blur, closed eyes, and burst duplicates.
4. **Adaptive Personalization** that learns from photographer overrides.
5. **Native Adobe XMP Export** for seamless integration with Adobe Lightroom & Photo Mechanic.

---

## 🚀 Complete 3-Week Workflow

```text
  [ Create Client ]
          ↓
  [ Create Booking ]
          ↓
  [ Event Workspace ] (Chronological scheduling & Closest Upcoming Events)
          ↓
  [ Local Photo Ingestion ] (Fast local-first storage, no upload bottlenecks)
          ↓
  [ Multi-Stage AI Analysis ]
    ├── Laplacian Variance (Sharpness / Blur detection)
    ├── OpenCV YuNet + Haar Cascade (Face & Closed-Eye detection)
    └── Perceptual Hashing (Visual similarity & burst clustering)
          ↓
  [ Burst & Duplicate Grouping ] (Auto-recommends best sharp frame)
          ↓
  [ Photographer Review & Overrides ] (AI recommends Keep/Review; Photographer decides Keep/Reject)
          ↓
  [ Personalization Layer ] (Calculates override rates & refines future criteria)
          ↓
  [ Final Curated Selection ]
          ↓
  [ Adobe XMP Sidecar Export ] (One-click zip export for Lightroom Classic)
```

---

## ✨ Core Features

| Feature | Description | Status |
| :--- | :--- | :---: |
| **Client Management** | Comprehensive client registry with email, phone, and name strict validation rules. | ✅ Active |
| **Booking Tracking** | Track packages, event dates, pricing, advance deposits, and status. | ✅ Active |
| **Event Workspace** | Dedicated workspace per shoot with event time, venue location, and photo stats. | ✅ Active |
| **Closest Upcoming Events** | Dashboard prioritizes imminent shoots with chronological badges and times. | ✅ Active |
| **Smart AI Culling** | Independent blur scoring, face landmark detection, and eye openness verification. | ✅ Active |
| **Burst Detection** | Clusters rapid-fire burst sequences and automatically flags duplicate frames. | ✅ Active |
| **Personalization Engine** | Analyzes photographer overrides to learn personal curation preferences. | ✅ Active |
| **Lightroom XMP Export** | Generates industry-standard `.xmp` metadata sidecars in a downloadable `.zip`. | ✅ Active |
| **Universal Responsive UI** | Auto-scaling fluid layout supporting 4K desktop, laptops, tablets, and smartphones. | ✅ Active |
| **Zero-Config DB Fallback** | Seamlessly runs with local SQLite (`serendibsuite.db`) or MySQL/MariaDB. | ✅ Active |

---

## 🧠 AI-Assisted Photo Analysis Pipeline

The AI engine in SerendibSuite acts as a **tireless second shooter**, accelerating triage without taking creative agency away from the photographer.

```text
                     Photo Input
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
   Laplacian Blur     OpenCV YuNet      Perceptual
     Detection       Eye Landmark         pHash
   (Score < 100)     (Open / Closed)    (Duplicates)
         │                │                │
         └────────────────┼────────────────┘
                          ▼
                AI Recommendation
               ┌──────────┴──────────┐
             [KEEP]               [REVIEW]
               │                     │
               └──────────┬──────────┘
                          ▼
                Photographer Decision
               ┌──────────┴──────────┐
             [KEEP]               [REJECT]
                          │
                          ▼
                 Final Selection & XMP
```

### 1. Sharpness & Blur Detection
Utilizes OpenCV Laplacian kernel variance:
$$\text{Score} = \text{Var}(\nabla^2 I)$$
Images scoring below the configurable threshold (default `100.0`) are automatically flagged as blurry.

### 2. Deep Face & Eye Landmark Detection
Employs modern **OpenCV YuNet ONNX** with automated fallback to Haar cascades. Accurately determines if subjects in portraits have closed or squinting eyes during critical moments.

### 3. Perceptual Duplicate Grouping
Generates 64-bit perceptual hashes (`pHash`). Successive frames in burst shots with a Hamming distance $\le 10$ are clustered, automatically picking the single sharpest frame as the hero recommendation.

### 4. Human-in-the-Loop Philosophy
* **AI Recommendation:** `KEEP` or `REVIEW`
* **Photographer Decision:** `KEEP` or `REJECT`
* Human decisions **never overwrite** AI telemetry, enabling the personalization engine to calculate precise override weights.

---

## 🏗️ System Architecture

```text
                  ┌─────────────────────────────────────────┐
                  │       Responsive Modern Frontend        │
                  │   HTML5 • Vanilla ES6+ • Fluid CSS3     │
                  └────────────────────┬────────────────────┘
                                       │ HTTP / JSON (REST)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │          FastAPI Backend Core           │
                  │   Uvicorn • Pydantic v2 • SQLAlchemy    │
                  └──────────────┬──────────────────┬───────┘
                                 │                  │
                ┌────────────────┴──────┐           │
                ▼                       ▼           ▼
        ┌──────────────┐        ┌──────────────┐ ┌──────────────┐
        │  Computer    │        │ Persistence  │ │ Storage      │
        │  Vision / AI │        │ Layer        │ │ Layer        │
        │  • OpenCV    │        │ • SQLite     │ │ • Local-first│
        │  • YuNet     │        │ • MySQL      │ │   originals  │
        │  • ImageHash │        │ • Schema v2  │ │ • Sidecars   │
        └──────────────┘        └──────────────┘ └──────────────┘
```

### 📂 Project Structure

```text
SerendibSuite/
├── ai/                              # Computer Vision & Intelligence
│   ├── blur_detection.py            # Laplacian variance sharpness
│   ├── eye_detection.py             # YuNet & Haar cascade eye detector
│   ├── similarity.py                # Perceptual hash & burst clustering
│   ├── personalization.py           # Adaptive override learning engine
│   └── models/                      # Lightweight onnx and xml models
├── backend/                         # FastAPI Application Backend
│   ├── app/
│   │   ├── api/                     # REST Endpoints (Clients, Bookings, Events, Photos, XMP)
│   │   ├── database/                # Database engine & session factories
│   │   ├── models/                  # SQLAlchemy ORM Models
│   │   └── schemas/                 # Strict Pydantic validation schemas
│   └── requirements.txt             # Python dependencies
├── frontend/                        # Client-Side Application
│   ├── css/style.css                # Fluid responsive design (Dark theme)
│   ├── js/app.js                    # SPA application state & view controller
│   ├── js/api.js                    # Fetch API client wrapper
│   └── index.html                   # Semantic HTML5 shell
├── storage/                         # Local-first media store & SQLite DB
├── populate_10_photos.py            # Showcase photo population script
└── README.md                        # Documentation
```

---

## ⚡ Getting Started

### Prerequisites
* **Python 3.10+**
* Modern web browser (Chrome, Edge, Firefox, Safari)
* *(Optional)* MySQL / MariaDB via XAMPP (defaults to zero-config SQLite if not installed)

---

### 1. Installation

```powershell
# Clone the repository
git clone https://github.com/NimsaraP/SerendibSuite.git
cd SerendibSuite

# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS / Linux:
source .venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt
```

---

### 2. Running the Servers

Open two terminal windows:

#### Terminal 1 — Backend API Server
```powershell
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
> 📍 API will be active at: `http://127.0.0.1:8000`  
> 📚 Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

#### Terminal 2 — Frontend Web Server
```powershell
python -m http.server 5500 --directory frontend
```
> 🌐 Open your browser and navigate to: **`http://127.0.0.1:5500`**

---

### 3. Showcase & Test Data Setup (Optional)

To immediately populate the system with **13 upcoming events** and **10 curated showcase photos** (8 real portraits + 2 detail shots):

```powershell
# Seed demo clients, bookings, and realistic scheduled events
python update_events_schedule.py

# Populate showcase photo set
python populate_10_photos.py
```

---

## 📡 API Endpoints

<details>
<summary><b>Click to expand full API specification</b></summary>

### 👤 Clients
* `POST /api/clients` — Create a new client (with name, email, phone validations)
* `GET  /api/clients` — Retrieve all registered clients

### 📅 Bookings
* `POST /api/bookings` — Create a booking linked to a client
* `GET  /api/bookings` — Retrieve all bookings with client details

### 🎪 Events
* `POST /api/events` — Create an event workspace with date, time, and location
* `GET  /api/events` — List all events (supports chronological ordering)

### 🖼️ Photos & AI Culling
* `POST  /api/photos/` — Upload one or more photos to an event
* `GET   /api/photos/with-analysis?event_id={id}` — Fetch event photos with AI scores
* `POST  /api/photos/{photo_id}/analyse` — Run AI analysis on a single photo
* `PATCH /api/photos/{photo_id}/decision` — Update photographer decision (`keep` / `reject`)
* `GET   /api/photos/burst-groups?event_id={id}` — Retrieve clustered duplicate sequences
* `GET   /api/photos/personalization-insights` — Get override analytics and learned weights
* `GET   /api/photos/export-xmp?event_id={id}` — Download Adobe XMP sidecars zip archive

</details>

---

## 🗺️ Roadmap & Milestones

- [x] **Milestone 1 — Core Foundation**
  - FastAPI backend, database schemas, local storage, API routing.
- [x] **Milestone 2 — Photographer Workflow**
  - End-to-end client $\to$ booking $\to$ event $\to$ photo upload pipeline.
  - Multi-stage CV analysis (Laplacian Blur + YuNet/Haar Face & Eye detection).
  - Batch photo analysis and separate AI recommendation vs Human decision.
- [x] **Milestone 3 — Advanced Workflow Extensions**
  - Perceptual hash burst/duplicate grouping.
  - Personalization engine tracking decision overrides.
  - Adobe XMP sidecar zip export for Lightroom Classic.
  - Strict input validations (Names, Emails, Sri Lankan & International Phone Numbers).
  - 100% fluid mobile-first responsive scaling across all screen sizes.
- [ ] **Milestone 4 — Multi-Tenancy & SaaS Infrastructure (Planned)**
  - JWT Authentication & photographer registration.
  - Tenant database isolation.
  - Client-facing preview gallery and selection portal.
  - Background asynchronous task workers (Celery / Redis).

---

## 📄 License & Intellectual Property

This project is developed for the **IntelliCon** initiative. All rights reserved. Private development.

<div align="center">
<sub>Crafted with passion for Sri Lankan Event Photographers 🇱🇰</sub>
</div>