# 📸 SerendibSuite

<div align="center">

![SerendibSuite Banner](https://img.shields.io/badge/SerendibSuite-Photography%20Workflow%20Platform-4f46e5?style=for-the-badge&logo=camera)

**AI-Assisted Workflow & Intelligent Culling Platform for Solo & Small-Team Event Photographers**

[![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-5.0-5C3EE8?style=flat-square&logo=opencv&logoColor=white)](https://opencv.org)
[![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20MySQL-orange?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com)
[![Submission Status](https://img.shields.io/badge/Submission-Gate%203%20Final%20(65%25)-gold?style=flat-square&logo=github)](https://github.com/NimsaraP/SerendibSuite)
[![Live Frontend Demo](https://img.shields.io/badge/Live%20Demo-Netlify-00C7B7?style=flat-square&logo=netlify&logoColor=white)](https://serendibsuite.netlify.app/)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile%20Responsive-brightgreen?style=flat-square)]()

[Live Frontend Demo](https://serendibsuite.netlify.app/) • [Features](#-core-features) • [Feature Audit](#-feature-audit-fully-functional-vs-mocked--roadmap) • [AI Pipeline](#-ai-assisted-photo-analysis-pipeline) • [Quick Start](#-quick-start--setup-guide) • [API Reference](#-api-endpoints-summary)

---

</div>

## 📌 Submission Gate 3 — Final Submission Overview

This repository represents the **Final Submission (Gate 3 — 65% of Total Score)** for the IntelliCon 2026 platform. It combines complete business lifecycle management with local computer vision inference, demonstrating how a specialized tool can eliminate post-shoot fatigue for event photographers in Sri Lanka and emerging markets.

> 🌐 **Live Frontend Deployment:** [https://serendibsuite.netlify.app/](https://serendibsuite.netlify.app/)  
> *Note:* The Netlify deployment showcases the complete client-side user experience, fluid mobile-responsive UI, dashboard analytics, client management forms, and studio workflow. To run the full-stack system with local Computer Vision AI inference (OpenCV blur scoring, deep face/eye landmark analysis, and Lightroom XMP sidecar generation), clone the repository and run the local FastAPI backend as detailed in the [Quick Start Guide](#-quick-start--setup-guide).

---

## 🎯 Feature Audit: Fully Functional vs. Mocked / Roadmap

As required by the **Gate 3 Rubric**, the matrix below explicitly details which capabilities are **100% functional and testable today**, alongside our planned commercial SaaS extensions:

### ✅ Core Capabilities (100% Fully Functional & Verifiable)

| Module / Feature | Status | Technical Implementation |
| :--- | :---: | :--- |
| **Client Management & Validation** | ✅ **100% Functional** | Full CRUD with real-time regex validation for client names, email addresses, and Sri Lankan (`+94` / `07X`) and international phone numbers. |
| **Booking & Financial Tracking** | ✅ **100% Functional** | Track packages, prices, advance deposits paid, balance due, and booking status linked to clients. |
| **Chronological Event Workspace** | ✅ **100% Functional** | Dedicated event workspaces with upcoming schedule prioritization, countdown badges, and photo statistics. |
| **Multi-Format Photo Ingestion** | ✅ **100% Functional** | Ingestion for `.jpg`, `.jpeg`, `.jfif`, `.png`, `.webp`, and vector `.svg` with sanitized local-first storage. |
| **Mathematical Blur Detection** | ✅ **100% Functional** | OpenCV Laplacian variance ($\text{Var}(\nabla^2 I)$) sharpness calculation; flags motion blur and soft focus below threshold 100. |
| **Deep Face & Eye Blink Detection** | ✅ **100% Functional** | OpenCV YuNet ONNX neural network regressing 5 facial landmarks to detect blinks across portraits and group photos with automated Haar fallback. |
| **Full-Face Boundary Validation** | ✅ **100% Functional** | Landmark coordinate boundary checks requiring eyes, nose, and mouth to be inside the frame, preventing false positives on macro eye/jewelry detail shots. |
| **Burst & Duplicate Clustering** | ✅ **100% Functional** | 64-bit Perceptual Hash (pHash) clustering rapid-fire burst sequences (Hamming distance $\le 10$) and auto-recommending the sharpest hero frame. |
| **Human-in-the-Loop Decisions** | ✅ **100% Functional** | Strict telemetry separation: AI provides recommendations (`KEEP`/`REVIEW`); photographer records definitive decisions (`Keep`/`Reject`). |
| **Adaptive Personalization Engine** | ✅ **100% Functional** | Calculates human override ratios on AI reviews/keeps to provide studio-specific sensitivity insights. |
| **Adobe Lightroom XMP Sidecar Export** | ✅ **100% Functional** | Generates industry-standard `.xmp` metadata sidecars in a single `.zip` download ready for instant Lightroom Classic ingestion. |
| **Zero-Config Resilient Database** | ✅ **100% Functional** | Automatically runs on local SQLite (`serendibsuite.db`) or discovers local XAMPP MySQL without user configuration. |
| **Fluid Mobile-First Responsive UI** | ✅ **100% Functional** | Dark studio aesthetic with 3-in-1 breadcrumb back-navigation, floating scroll-to-top, and fullscreen image modal. |

### 🚀 Future Commercial SaaS Expansion Roadmap (Planned v2)

| Roadmap Feature | Phase | Architectural Vision |
| :--- | :---: | :--- |
| **Multi-Tenant Cloud Auth (JWT)** | ⏳ *SaaS Tier* | Currently architected as a local studio workspace for zero-latency offline performance; JWT auth planned for multi-user cloud tier. |
| **Client-Facing Web Proofing Gallery** | ⏳ *SaaS Tier* | Client selection portal planned for v2; currently focused on photographer triage and Adobe Lightroom export. |
| **Distributed Cloud Workers (Celery/Redis)** | ⏳ *SaaS Tier* | Synchronous/multithreaded local execution currently active; Redis queue planned for multi-user server deployment. |
| **Native Mobile App (Android APK / iOS)** | ⏳ *SaaS Tier* | 100% responsive PWA-ready web application currently live across desktop, tablet, and mobile browsers. |

---

## 📖 Executive Summary & Problem Domain

> **One-Line Problem:** Solo and small-team event photographers in Sri Lanka lose 3 to 6 hours per event manually sorting thousands of raw photos, using disconnected WhatsApp threads and spreadsheets with no unified, affordable AI tool built for their scale.

### The Pain Point
Event photographers covering weddings, corporate galas, and parties capture 1,000–3,000 photos per shoot. Afterward, they spend hours manually checking focus and open eyes before creative editing can begin. Foreign AI tools cost \$15–\$30/month, require heavy GPU cloud uploads, and ignore studio booking management.

**SerendibSuite** solves this by unifying:
1. **Client & Booking Management** with strict field validations.
2. **Event Workspaces** with smart chronological scheduling.
3. **Local AI Culling Engine** detecting blur, closed eyes, and burst duplicates offline.
4. **Adaptive Personalization** that learns from photographer overrides.
5. **Native Adobe XMP Export** for seamless integration with Adobe Lightroom Classic.

---

## 🚀 Complete 3-Week Workflow

```text
  [ Create Client ] (Name, Email, Phone regex validation)
          ↓
  [ Create Booking ] (Package, Price, Advance deposit, Status)
          ↓
  [ Event Workspace ] (Chronological scheduling & Closest Upcoming Events)
          ↓
  [ Local Photo Ingestion ] (Fast local-first storage, no upload bandwidth)
          ↓
  [ Multi-Stage AI Analysis ]
    ├── Laplacian Variance (Sharpness / Blur detection)
    ├── OpenCV YuNet + Landmark Boundary Check (Full Face & Eye blink detection)
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
Employs modern **OpenCV YuNet ONNX** neural network. Regresses 5 key facial landmarks (eyes, nose, mouth) and validates:
- **Full-Face Boundary Check:** All 5 landmarks must be within image coordinates, preventing tightly cropped macro eye or jewelry shots from falsely triggering face status.
- **Eye Openness Calculation:** Evaluates eye patch gradients and pixel intensity ratios to flag closed or blinking eyes.

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
│   ├── eye_detection.py             # YuNet & full-face boundary validator
│   ├── similarity.py                # Perceptual hash & burst clustering
│   ├── personalization.py           # Adaptive override learning engine
│   └── models/                      # Lightweight ONNX models (< 500 KB)
├── backend/                         # FastAPI Application Backend
│   ├── app/
│   │   ├── api/                     # REST Endpoints (Clients, Bookings, Events, Photos, XMP)
│   │   ├── database/                # Database engine with SQLite/MySQL fallback
│   │   ├── models/                  # SQLAlchemy ORM Models
│   │   └── schemas/                 # Strict Pydantic validation schemas
│   └── requirements.txt             # Python dependencies
├── frontend/                        # Client-Side Application
│   ├── css/style.css                # Fluid responsive design (Dark studio theme)
│   ├── js/app.js                    # SPA application state & view controller
│   ├── js/api.js                    # Fetch API client wrapper
│   └── index.html                   # Semantic HTML5 shell
├── docs/                            # Technical Architecture & Specifications
│   └── architecture.md              # Detailed architecture documentation
├── storage/                         # Local-first media store & SQLite DB
├── populate_10_photos.py            # Showcase photo population script
└── README.md                        # Documentation
```

---

## ⚡ Quick Start & Setup Guide

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

### 2. Running the Application

Open two terminal windows:

#### Terminal 1 — Backend API Server
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
> 📍 API active at: `http://127.0.0.1:8000`  
> 📚 Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

#### Terminal 2 — Frontend Web Server
```powershell
python -m http.server 5500 --directory frontend
```
> 🌐 Open your browser and navigate to: **`http://127.0.0.1:5500`**

---

### 3. Showcase & Test Data Setup (Optional)

To immediately populate the system with realistic upcoming events, clients, bookings, and showcase event photos:

```powershell
# Seed demo clients, bookings, and scheduled events
python update_events_schedule.py

# Populate showcase photo set
python populate_10_photos.py
```

---

## 📡 API Endpoints Summary

<details>
<summary><b>Click to expand full REST API specification</b></summary>

### 👤 Clients
* `POST /api/clients` — Create a new client (with strict name, email, phone validations)
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

## 📄 License & Intellectual Property

This project is developed for the **IntelliCon 2026** competition. All rights reserved. Private development.

<div align="center">
<sub>Crafted with passion for Sri Lankan Event Photographers 🇱🇰</sub>
</div>