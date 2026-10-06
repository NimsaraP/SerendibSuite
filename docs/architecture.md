# SerendibSuite — Architecture & System Design

**SerendibSuite** is a lightweight, connected management and AI-assisted photo culling platform purpose-built for solo and small-team event photographers in Sri Lanka.

---

## 1. Problem & Market Overview

### The Problem
Solo and small-team event photographers lose 3 to 6 hours per event manually sorting through hundreds of raw photos in Lightroom or Photo Mechanic, alongside managing bookings and client inquiries across disconnected WhatsApp chats, Instagram DMs, and spreadsheets.

### Market Size (Sri Lanka)
- **TAM (Total Addressable Market):** ~3,000 active solo/small-team event photography businesses (derived from ~139,290 registered marriages/year at ~50 weddings/photographer capacity).
- **SAM (Serviceable Addressable Market):** ~1,800 digitally equipped single-operator studios.
- **SOM (Serviceable Obtainable Market - Year 1):** ~54 paying photographers (~3% adoption at LKR 2,500/month subscription = ~LKR 1.62M annual recurring revenue).

---

## 2. High-Level Architecture

The platform follows a privacy-respecting, local-first hybrid architecture:

```
┌──────────────────────────────────────────────────────────┐
│              Frontend Client (Browser UI)                │
│   HTML5 / Modern JavaScript SPA / Responsive Dark Theme  │
│  - Dashboard & Client/Booking Management                │
│  - Event Workspace & Photo Upload                       │
│  - AI Batch Culling & Live Progress                     │
│  - Burst / Near-Duplicate Group Clustering              │
│  - Personalization & Learning Audit Log                 │
│  - Adobe Lightroom / Photo Mechanic XMP Export          │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTP / REST / JSON & Multipart
                             ▼
┌──────────────────────────────────────────────────────────┐
│              FastAPI Backend Application                 │
│  - REST Endpoints (/clients, /bookings, /events, /photos)│
│  - Zero-setup SQLite fallback / Production MySQL engine │
│  - Local-first file storage (privacy, zero cloud lag)   │
└──────────────┬────────────────────────────┬──────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────────────┐ ┌─────────────────────────┐
│     AI Culling Pipeline      │ │  Personalization Engine │
│ - OpenCV Blur (Laplacian var)│ │ - Override Audit Logger │
│ - MediaPipe / Haar Eye Detect│ │ - Adaptive Blur Tuning  │
│ - ImageHash pHash Clustering │ │ - Style Preference Model│
│ - Burst Top-Pick Ranking     │ └─────────────────────────┘
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Lightroom / XMP Exporter    │
│ - Industry-standard .xmp     │
│ - Star ratings (5=Keep,0=Rej)│
│ - Color labels (Green / Red) │
│ - Bundled in ZIP archive     │
└──────────────────────────────┘
```

---

## 3. Core Modules

### 3.1 Client, Booking & Event Workspace
- Manages client CRM records (name, email, phone, notes).
- Manages bookings with dates, job status (`enquiry`, `confirmed`, `completed`, `cancelled`).
- Each booking links to specific shoot occasions (**Events**), which serve as the workspace for uploading and processing photos.

### 3.2 AI Culling Pipeline
1. **Blur & Sharpness Detection (`ai/blur_detection.py`):**
   - Employs OpenCV's Laplacian variance operator on grayscale images.
   - Computes variance of high-contrast edges to produce a sharpness score.
   - Default baseline threshold: `100.0` (dynamically adjusted per photographer).
2. **Face & Closed-Eye Detection (`ai/eye_detection.py`):**
   - Uses MediaPipe FaceLandmarker / 478-point mesh to calculate Eye Aspect Ratio (EAR).
   - Identifies whether eyes are open, closed, or partially closed.
   - Robust fallback to OpenCV Haar cascades if MediaPipe assets are absent.
3. **Burst & Near-Duplicate Clustering (`ai/similarity.py`):**
   - Calculates 64-bit Perceptual Hash (`pHash`) resistant to minor variations.
   - Clusters frames with Hamming distance $\le 10$ into Burst Groups.
   - Automatically selects the **AI Top Pick** based on sharpness score and eye expression.
4. **Adaptive Personalization Layer (`ai/personalization.py`):**
   - Learns from every photographer override (`culling_overrides`).
   - If a photographer keeps softer/candid shots or artistic motion, the system adapts their individual blur threshold.
   - Tracks convergence depth and stylistic preference.

### 3.3 Export to Industry Tools (`backend/app/api/export_xmp.py`)
- Generates Adobe XMP sidecar XML files (`.xmp`).
- Sets:
  - `xmp:Rating`: 5 stars for Kept photos, 0 stars for Rejected photos.
  - `xmp:Label`: `Green` for Kept, `Red` for Rejected.
  - Urgency and Dublin Core subject tags.
- Bundled into a single ZIP archive for instant import into Lightroom Classic and Photo Mechanic.

---

## 4. Database Schema

The database supports both MySQL/MariaDB and SQLite:

1. `users` — Photographer account details.
2. `clients` — Client contacts linked to the photographer.
3. `bookings` — Specific photography packages and jobs.
4. `events` — Shoot occasions within bookings.
5. `photos` — File metadata and stored locations.
6. `photo_analysis` — AI scores (blur, face, eyes, pHash, recommendations, and decisions).
7. `culling_overrides` — Audit log of photographer overrides used for adaptive learning.

---

## 5. Three-Week Plan & Milestone Status

| Week | Planned Deliverables | Status |
|---|---|---|
| **Week 1** | Client/booking tracker, event workspace, local photo storage, blur & eye detection | **Completed** |
| **Week 2** | Burst/duplicate grouping via pHash, review & override UI, override audit logging | **Completed** |
| **Week 3** | Personalization engine (adaptive blur threshold), XMP sidecar export, end-to-end integration | **Completed** |
