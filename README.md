# SerendibSuite

SerendibSuite is a photographer-focused B2B workflow platform designed to help photographers manage clients, bookings, events, photo uploads, and AI-assisted photo selection from one system.

The current version focuses on the core photographer workflow and establishes the foundation for future multi-tenant SaaS functionality.

---

## Current Status

**Gate 2 – Photographer Workflow: Complete**

The current implementation supports an end-to-end photographer workflow:

```text
Create Client
    ↓
Create Booking
    ↓
Create Event
    ↓
Upload Photos
    ↓
Run AI Analysis
    ↓
Review AI Recommendations
    ↓
Photographer Keeps / Rejects Photos
    ↓
Final Selection

The current implementation is intended as a working foundation for the future SaaS product.

Authentication, production multi-tenancy, client portals, billing, cloud storage, background workers, and production deployment are planned for later development stages.

Features
Client Management

Photographers can:

Create clients
View clients
Link clients to bookings
Start a new job from the dashboard

Each booking is associated with a client.

Booking Management

Photographers can:

Create bookings
Associate bookings with clients
View existing bookings
Use bookings as the parent record for events

The current workflow allows a photographer to create a client first and then create a booking for that client.

Event Management

Photographers can:

Create events
Associate events with bookings
View event details
See booking and client information from the event
Upload photos to an event

The event acts as the main workspace for the photography job.

Photo Management

The current system supports:

Multiple photo uploads
JPEG images
PNG images
Local photo storage
Photo thumbnails/previews
Individual photo retrieval
Event-level photo listing
Photo analysis status tracking

Photos are currently stored using the application's local storage system.

AI-Assisted Photo Analysis

SerendibSuite includes an AI-assisted photo analysis pipeline designed to help photographers review large sets of photos.

The AI does not automatically make the final decision for the photographer.

The current analysis pipeline includes:

Blur Detection

OpenCV-based Laplacian variance is used to estimate image sharpness/blur.

Face Detection

Face detection is performed using MediaPipe, with Haar cascade fallback support.

Eye Detection

The system attempts to determine whether eyes are detected in relevant faces.

Perceptual Hashing

Perceptual hashing is used to generate similarity information for photos.

The resulting hash information can be used to identify visually similar images.

AI Recommendation

The current system provides an AI recommendation:

keep
review

The recommendation is intended as an assistance mechanism for the photographer.

Photographer Decisions

The photographer remains the final decision maker.

The system keeps the AI recommendation separate from the photographer's decision.

A photo can therefore have:

AI Recommendation: review

Photographer Decision: keep

This means the photographer can override the AI recommendation without changing the original AI result.

Current photographer decisions are:

keep
reject

This separation is intentional and will allow the AI system to be improved independently in future versions.

Batch AI Analysis

Photographers can analyse multiple photos from an event using the batch analysis workflow.

The current interface supports:

Analyse All
Analyse Remaining
Sequential photo analysis
Progress feedback
Individual AI recommendations
Photographer review after analysis

This allows the photographer to process a complete event rather than manually analysing every photo one at a time.

Final Selection

The Event Detail page contains a Final Selection section.

The Final Selection contains photos that the photographer has explicitly marked as:

keep

The final selection is therefore based on the photographer's decisions rather than automatically deleting photos based on AI recommendations.

Technology Stack
Backend
Python
FastAPI
SQLAlchemy
MySQL
PyMySQL
Pydantic
Frontend
HTML
CSS
Vanilla JavaScript
AI / Computer Vision
OpenCV
MediaPipe
ImageHash
Pillow
Storage
Local filesystem storage
Architecture

The current system follows a simple frontend/API/database architecture.

                 ┌──────────────────────┐
                 │      Frontend        │
                 │ HTML / CSS / JS      │
                 └──────────┬───────────┘
                            │
                            │ HTTP / JSON
                            ▼
                 ┌──────────────────────┐
                 │      FastAPI         │
                 │       Backend        │
                 └──────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
        Clients        Bookings         Events
                                           │
                                           ▼
                                        Photos
                                           │
                                           ▼
                                    AI Analysis
                                           │
                                           ▼
                                      MySQL DB

Photo files are currently stored locally while metadata and analysis information are stored in the database.

Data Model

The current application follows this relationship:

User
 │
 └── Client
      │
      └── Booking
           │
           └── Event
                │
                └── Photo
                     │
                     └── PhotoAnalysis

The intended future architecture will use the photographer/user as the tenant boundary.

Photo Analysis Workflow

The current photo workflow is:

              Photo Upload
                   │
                   ▼
             Photo Analysis
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
      Blur       Faces       Eyes
    Detection   Detection   Detection
        │          │          │
        └──────────┼──────────┘
                   │
                   ▼
             Perceptual Hash
                   │
                   ▼
            AI Recommendation
                   │
              ┌────┴────┐
              │         │
              ▼         ▼
            Keep      Review
              │         │
              └────┬────┘
                   ▼
          Photographer Review
                   │
             ┌─────┴─────┐
             │           │
             ▼           ▼
           Keep        Reject
             │
             ▼
       Final Selection

The AI recommendation and photographer decision are stored separately.

API Endpoints
Clients
POST /api/clients
GET  /api/clients
Bookings
POST /api/bookings
GET  /api/bookings
Events
POST /api/events
GET  /api/events
Photos
POST  /api/photos/
GET   /api/photos/
GET   /api/photos/{photo_id}
GET   /api/photos/{photo_id}/file
POST  /api/photos/{photo_id}/analyse
GET   /api/photos/with-analysis?event_id={event_id}
PATCH /api/photos/{photo_id}/decision
Project Structure

The project is currently organized around separate backend and frontend applications.

SerendibSuite/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── ...
│   │
│   ├── seed_test_data.py
│   └── requirements.txt
│
├── frontend/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── storage/
│
└── README.md

The exact internal structure may evolve as development continues.


Running Locally
Requirements

Before running SerendibSuite locally, install:

Python
MySQL
Git

A modern web browser is also required.

1. Clone the Repository
git clone <repository-url>
cd SerendibSuite
2. Create a Python Virtual Environment
Windows
python -m venv .venv
.venv\Scripts\activate
Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
3. Install Backend Dependencies
pip install -r backend/requirements.txt
Database Configuration

SerendibSuite currently uses MySQL through SQLAlchemy and PyMySQL.

Create the required MySQL database and configure the database connection used by the backend.

Database credentials should remain local and must not be committed to Git.

Do not commit:

Passwords
API keys
Secret keys
Production credentials
Private configuration files

Use environment variables or another secure configuration method for sensitive values.

Start the Backend

From the project root:

uvicorn backend.app.main:app --reload

The API will normally be available at:

http://127.0.0.1:8000

FastAPI's interactive API documentation is available at:

http://127.0.0.1:8000/docs
Start the Frontend

The frontend can be served using Python's built-in HTTP server.

From the project root:

python -m http.server 5500 --directory frontend

Then open:

http://127.0.0.1:5500
Development Seed Data

A development seed script is included for testing the photographer workflow.

Run:

python backend/seed_test_data.py

The seed data is intended for local development and testing only.

Example End-to-End Workflow

A complete Gate 2 workflow can be tested using the following steps.

Step 1 — Create a Client

Create a new client from the Clients section or dashboard.

Step 2 — Create a Booking

Create a booking and associate it with the client.

Step 3 — Create an Event

Create an event and associate it with the booking.

Step 4 — Open Event Detail

The Event Detail page displays:

Event information
Booking information
Client information
Photo section
AI analysis section
Final Selection section
Step 5 — Upload Photos

Upload multiple JPEG or PNG photos to the event.

Step 6 — Analyse Photos

Use:

Analyse All

or:

Analyse Remaining

The system analyses the photos sequentially and displays progress.

Step 7 — Review AI Recommendations

Each analysed photo receives an AI recommendation.

The current recommendations are:

KEEP
REVIEW
Step 8 — Make Photographer Decisions

The photographer can independently choose:

KEEP
REJECT

The photographer decision does not overwrite the AI recommendation.

Step 9 — Review Final Selection

Photos marked by the photographer as:

KEEP

appear in the Final Selection section.

Current Limitations

The current Gate 2 implementation intentionally does not yet include the complete production SaaS infrastructure.

The following features are not yet implemented:

User authentication
Photographer registration
Login/logout
Password management
Production-grade multi-tenancy enforcement
Role-based permissions
Client-facing portal
Client accounts
Client photo selection
Gallery delivery
Cloud object storage
Background processing workers
Email notifications
Billing
Subscription management
Production deployment
Automated test suite
Advanced duplicate detection
Production-trained AI selection model

These features are planned for future development.

AI Design Philosophy

The AI system is designed as an assistant rather than an autonomous decision maker.

The current architecture intentionally separates:

AI Recommendation

from:

Photographer Decision

This allows the photographer to override AI recommendations and keeps the human decision as the final authority.

Future AI improvements can therefore be introduced without changing the basic photographer workflow.

Multi-Tenancy Direction

The long-term product is intended to support multiple photographers.

The intended model is:

Photographer A
 │
 ├── Clients
 ├── Bookings
 ├── Events
 └── Photos


Photographer B
 │
 ├── Clients
 ├── Bookings
 ├── Events
 └── Photos

Each photographer should only be able to access their own business data.

Authentication and strict tenant isolation will be implemented in a future development gate.

Product Direction

The long-term goal of SerendibSuite is to provide photographers with a complete business workflow.

The planned high-level workflow is:

                    Photographer
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
       Clients       Bookings        Events
                                         │
                                         ▼
                                       Photos
                                         │
                                         ▼
                                  AI Assistance
                                         │
                                         ▼
                                  Final Selection
                                         │
                                         ▼
                                  Client Gallery
                                         │
                                         ▼
                                  Client Delivery

The current Gate 2 implementation establishes the core photographer-side workflow required for this future system.

Roadmap
Gate 1 — Foundation
FastAPI backend
Database foundation
SQLAlchemy models
Initial frontend
Initial API structure

Status:

Complete
Gate 2 — Photographer Workflow
Client creation
Booking creation
Event creation
Event detail
Multiple photo upload
Local photo storage
Photo serving
AI photo analysis
Batch AI analysis
Blur detection
Face detection
Eye detection
Perceptual hashing
AI recommendations
Photographer Keep/Reject decisions
Final Selection

Status:

Complete
Gate 3 — Authentication and Multi-Tenancy

Planned:

Photographer registration
Login
Logout
Password security
Sessions/authentication
User authorization
Tenant isolation
Photographer-specific data access
Protection of API endpoints

Status:

Planned
Future Development

Planned future capabilities include:

Client portal
Client accounts
Online galleries
Client photo selection
Photo delivery
Cloud storage
Background AI processing
Email notifications
Billing and subscriptions
Advanced AI photo ranking
Improved duplicate detection
Production deployment
Monitoring and logging
Automated testing
Development Principles
1. Photographer Remains in Control

AI recommendations should assist the photographer rather than silently making irreversible decisions.

2. AI and Human Decisions Remain Separate

AI recommendations and photographer decisions should remain independently traceable.

3. Build Vertically

Each development gate should produce a working end-to-end workflow rather than isolated features.

4. Keep the Architecture Incremental

Production infrastructure should be introduced when the underlying workflow is stable.

5. Protect Tenant Boundaries

When authentication and multi-tenancy are introduced, every photographer's data must be isolated from other photographers.

6. Avoid Premature Automation

The system should first establish reliable workflows before introducing complex background processing, autonomous AI actions, or production infrastructure.

Security Notes

This project is currently under development.

The current Gate 2 implementation should be treated as a development environment rather than a production deployment.

Before production use, the application will require:

Authentication
Authorization
Tenant isolation
Secure password handling
Secure secret management
Input validation
File upload validation
File size restrictions
Secure file storage
Production database configuration
HTTPS
Logging and monitoring
Rate limiting
Production deployment configuration
Git Development

The project uses Git for version control.

A stable development checkpoint should be committed after completing each major development gate.

Example:

git status
git add .
git commit -m "feat: complete Gate 2 photographer workflow"
git push origin main

Future commits should use clear messages describing the purpose of the change.

License

This project is currently under private development.

License terms will be added when the project is prepared for public distribution.

Current Milestone
SerendibSuite
│
├── Gate 1 — Foundation
│   └── COMPLETE
│
├── Gate 2 — Photographer Workflow
│   └── COMPLETE
│
└── Gate 3 — Authentication & Multi-Tenancy
    └── NEXT

The current priority is to preserve the completed Gate 2 workflow as a stable checkpoint before beginning authentication and multi-tenant architecture.



...