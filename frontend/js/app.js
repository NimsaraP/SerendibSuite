/**
 * app.js — SerendibSuite Photographer Dashboard
 *
 * Single-page application logic.
 * Handles navigation, data fetching, and rendering all views.
 */

import {
    getClients,
    getBookings,
    getEvents,
    getEvent,
    getBooking,
    getClient,
    createClient,
    createBooking,
    createEvent,
    uploadPhoto,
    getPhotosByEvent,
    getPhotosWithAnalysis,
    photoFileUrl,
    analysePhoto,
    setDecision,
} from "./api.js";

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".section");

function showSection(sectionId) {
    sections.forEach(s => s.classList.remove("active"));
    navLinks.forEach(l => l.classList.remove("active"));

    const target = document.getElementById(sectionId);
    if (target) target.classList.add("active");

    const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
    if (activeLink) activeLink.classList.add("active");

    if (sectionId === "section-dashboard") loadDashboard();
    if (sectionId === "section-events")   loadEvents();
    if (sectionId === "section-clients")  loadClients();
    if (sectionId === "section-bookings") loadBookings();
}

navLinks.forEach(link => {
    link.addEventListener("click", e => {
        e.preventDefault();
        showSection(link.dataset.section);
    });
});

// After creating a client/booking, pre-select them on the next form.
let pendingBookingClientId = null;
let pendingEventBookingId = null;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function statusBadge(st) {
    const cls = {
        scheduled:   "badge-blue",
        in_progress: "badge-yellow",
        completed:   "badge-green",
        cancelled:   "badge-red",
        enquiry:     "badge-gray",
        confirmed:   "badge-blue",
    }[st] || "badge-gray";
    return `<span class="badge ${cls}">${st.replace("_", " ")}</span>`;
}

function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="error-msg">&#9888; ${message}</div>`;
}

function showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="loading-msg">Loading&#8230;</div>`;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function loadDashboard() {
    try {
        const [clients, bookings, events] = await Promise.all([
            getClients(),
            getBookings(),
            getEvents(),
        ]);

        document.getElementById("stat-clients").textContent  = clients.length;
        document.getElementById("stat-bookings").textContent = bookings.length;

        const upcoming = events.filter(e =>
            e.status === "scheduled" || e.status === "in_progress"
        );
        document.getElementById("stat-upcoming").textContent = upcoming.length;

        const sorted = [...events].sort(
            (a, b) => new Date(b.event_date) - new Date(a.event_date)
        ).slice(0, 5);

        const container = document.getElementById("recent-events-list");
        if (sorted.length === 0) {
            container.innerHTML = `<p class="empty-msg">No events yet. Create one to get started.</p>`;
        } else {
            container.innerHTML = sorted.map(ev => `
                <div class="recent-event-item" data-id="${ev.id}">
                    <div class="rei-name">${ev.name}</div>
                    <div class="rei-meta">
                        <span>${formatDate(ev.event_date)}</span>
                        <span>${ev.location || "Location TBD"}</span>
                        ${statusBadge(ev.status)}
                    </div>
                </div>
            `).join("");

            container.querySelectorAll(".recent-event-item").forEach(item => {
                item.addEventListener("click", () => openEventDetail(item.dataset.id));
            });
        }
    } catch (err) {
        showError("recent-events-list", "Could not load dashboard data. Is the backend running?");
        console.error("[Dashboard]", err);
    }
}

// ---------------------------------------------------------------------------
// Events list
// ---------------------------------------------------------------------------
async function loadEvents() {
    const container = document.getElementById("events-list");
    showLoading("events-list");
    try {
        await populateEventBookingSelect();
        const events = await getEvents();
        if (events.length === 0) {
            container.innerHTML = `<p class="empty-msg">No events yet. Use the form above to create one.</p>`;
            return;
        }
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Event Name</th>
                        <th>Date</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${events.map(ev => `
                        <tr>
                            <td>${ev.id}</td>
                            <td>${ev.name}</td>
                            <td>${formatDate(ev.event_date)}</td>
                            <td>${ev.location || "—"}</td>
                            <td>${statusBadge(ev.status)}</td>
                            <td>
                                <button class="btn-open" data-id="${ev.id}">
                                    Open Event
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        container.querySelectorAll(".btn-open").forEach(btn => {
            btn.addEventListener("click", () => openEventDetail(btn.dataset.id));
        });
    } catch (err) {
        showError("events-list", err.message);
        console.error("[Events]", err);
    }
}

// ---------------------------------------------------------------------------
// Event detail view
// ---------------------------------------------------------------------------
let _currentEventId = null;

async function openEventDetail(eventId) {
    _currentEventId = eventId;
    showSection("section-event-detail");

    const container = document.getElementById("event-detail-content");
    container.innerHTML = `<div class="loading-msg">Loading event&#8230;</div>`;

    try {
        const ev = await getEvent(eventId);

        let booking = null;
        let client  = null;
        try {
            booking = await getBooking(ev.booking_id);
            client  = await getClient(booking.client_id);
        } catch (_) { /* non-fatal */ }

        container.innerHTML = `
            <div class="detail-grid">
                <!-- Event info card -->
                <div class="detail-card">
                    <h3>&#128247; Event Information</h3>
                    <div class="detail-row"><span>Name</span><strong>${ev.name}</strong></div>
                    <div class="detail-row"><span>Date</span><strong>${formatDate(ev.event_date)}</strong></div>
                    <div class="detail-row"><span>Location</span><strong>${ev.location || "—"}</strong></div>
                    <div class="detail-row"><span>Status</span>${statusBadge(ev.status)}</div>
                    <div class="detail-row"><span>Created</span><strong>${formatDate(ev.created_at)}</strong></div>
                </div>

                <!-- Booking + client context card -->
                <div class="detail-card">
                    <h3>&#128203; Booking &amp; Client</h3>
                    ${booking ? `
                        <div class="detail-row"><span>Booking</span><strong>${booking.title}</strong></div>
                        <div class="detail-row"><span>Booking Date</span><strong>${formatDate(booking.booking_date)}</strong></div>
                        <div class="detail-row"><span>Booking Status</span>${statusBadge(booking.status)}</div>
                    ` : `<p class="empty-msg">Booking info unavailable.</p>`}
                    ${client ? `
                        <div class="detail-row"><span>Client</span><strong>${client.name}</strong></div>
                        <div class="detail-row"><span>Email</span><strong>${client.email}</strong></div>
                        <div class="detail-row"><span>Phone</span><strong>${client.phone || "—"}</strong></div>
                    ` : ""}
                </div>

                <!-- Photos workspace — full width -->
                <div class="detail-card full-width" id="photos-section">

                    <!-- ── Header row: title + Final Selection ── -->
                    <div class="photos-header">
                        <h3>&#128444; Photos <span class="photo-count-badge" id="photo-count-badge"></span></h3>
                        <button class="btn-final-selection" id="btn-final-selection">
                            &#9733; View Final Selection
                        </button>
                    </div>

                    <!-- ── Summary bar (counts) ── -->
                    <div id="photo-summary-bar"></div>

                    <!-- ── AI Batch Action bar ── -->
                    <div class="batch-action-bar" id="batch-action-bar"></div>

                    <!-- ── Batch progress panel (hidden until batch runs) ── -->
                    <div class="batch-progress-panel" id="batch-progress-panel" style="display:none">
                        <div class="batch-progress-header">
                            <span class="batch-progress-title">&#10024; AI ANALYSIS IN PROGRESS</span>
                            <span class="batch-progress-label" id="batch-progress-label">Preparing&#8230;</span>
                        </div>
                        <div class="batch-progress-track">
                            <div class="batch-progress-fill" id="batch-progress-fill" style="width:0%"></div>
                        </div>
                        <div class="batch-checking-list">
                            Checking: &nbsp;
                            <span class="check-item">&#128269; Sharpness</span>
                            <span class="check-item">&#128578; Faces</span>
                            <span class="check-item">&#128065; Eyes</span>
                            <span class="check-item">&#128279; Image fingerprint</span>
                        </div>
                    </div>

                    <!-- ── Upload bar ── -->
                    <div class="upload-bar">
                        <label class="btn-upload-label" for="photo-file-input">
                            &#128194; Choose Photos
                        </label>
                        <input
                            type="file"
                            id="photo-file-input"
                            accept=".jpg,.jpeg,.png"
                            multiple
                            style="display:none"
                        />
                        <button class="btn-upload" id="btn-upload-photos">
                            &#11014; Upload Selected
                        </button>
                        <span class="upload-file-label" id="upload-file-label">No files selected</span>
                    </div>

                    <!-- ── Upload progress rows ── -->
                    <div id="upload-progress-area"></div>

                    <!-- ── Photo gallery grid ── -->
                    <div class="photo-gallery" id="photo-gallery">
                        <div class="loading-msg">Loading photos&#8230;</div>
                    </div>
                </div>

                <!-- Final selection panel (hidden by default) -->
                <div class="detail-card full-width final-selection-panel" id="final-selection-panel" style="display:none">
                    <div class="photos-header">
                        <h3>&#9733; Final Selection</h3>
                        <button class="btn-back-gallery" id="btn-back-gallery">
                            &#8592; Back to Gallery
                        </button>
                    </div>
                    <div class="final-selection-grid" id="final-selection-grid">
                        <div class="loading-msg">Loading&#8230;</div>
                    </div>
                </div>
            </div>
        `;

        // Wire up file input
        const fileInput = document.getElementById("photo-file-input");
        const fileLabel = document.getElementById("upload-file-label");
        const uploadBtn = document.getElementById("btn-upload-photos");

        fileInput.addEventListener("change", () => {
            const count = fileInput.files.length;
            fileLabel.textContent = count === 0
                ? "No files selected"
                : `${count} file${count > 1 ? "s" : ""} selected`;
        });

        uploadBtn.addEventListener("click", () => handleUpload(eventId));

        // Final selection toggle
        document.getElementById("btn-final-selection").addEventListener("click", () => {
            openFinalSelection(eventId);
        });
        document.getElementById("btn-back-gallery").addEventListener("click", () => {
            document.getElementById("final-selection-panel").style.display = "none";
            document.getElementById("photos-section").style.display = "";
        });

        // Load gallery
        await loadPhotoGallery(eventId);

    } catch (err) {
        container.innerHTML = `<div class="error-msg">&#9888; ${err.message}</div>`;
        console.error("[EventDetail]", err);
    }
}

// ---------------------------------------------------------------------------
// Photo gallery loader — fetches photos WITH analysis in one request
// ---------------------------------------------------------------------------
async function loadPhotoGallery(eventId) {
    const gallery = document.getElementById("photo-gallery");
    const badge   = document.getElementById("photo-count-badge");
    if (!gallery) return;

    gallery.innerHTML = `<div class="loading-msg">Loading photos&#8230;</div>`;

    try {
        const photos = await getPhotosWithAnalysis(eventId);

        // Update count badge
        if (badge) badge.textContent = photos.length > 0
            ? `${photos.length} photo${photos.length > 1 ? "s" : ""}`
            : "";

        // Update summary bar and action bar
        renderSummaryBar(photos);
        renderBatchActionBar(photos, eventId);

        if (photos.length === 0) {
            gallery.innerHTML = `
                <div class="photo-empty-state">
                    <div class="photo-empty-icon">&#128444;</div>
                    <p><strong>No photos uploaded yet.</strong></p>
                    <p class="upload-hint">Choose photos above and click Upload to begin.</p>
                </div>
            `;
            return;
        }

        gallery.innerHTML = photos.map(p => renderPhotoCard(p)).join("");
        attachAllCardListeners(gallery);

    } catch (err) {
        gallery.innerHTML = `<div class="error-msg">&#9888; Could not load photos: ${err.message}</div>`;
    }
}

// ---------------------------------------------------------------------------
// Smart Batch Action Bar — adapts to analysis state
// ---------------------------------------------------------------------------
function renderBatchActionBar(photos, eventId) {
    const bar = document.getElementById("batch-action-bar");
    if (!bar) return;

    const total      = photos.length;
    const analysed   = photos.filter(p => p.analysis !== null).length;
    const unanalysed = photos.filter(p => p.analysis === null);
    const remaining  = unanalysed.length;

    if (total === 0) {
        bar.innerHTML = "";
        return;
    }

    if (remaining === 0) {
        // All done
        bar.innerHTML = `
            <div class="batch-action-done">
                <span class="batch-done-icon">&#10003;</span>
                <span>All ${total} photos analysed</span>
                <span class="batch-done-hint">Use individual Re-analyse buttons to re-run specific photos.</span>
            </div>
        `;
        return;
    }

    const isPartial = analysed > 0;
    const btnLabel  = isPartial
        ? `&#10024; Analyse Remaining ${remaining} Photo${remaining > 1 ? "s" : ""} with AI`
        : `&#10024; Analyse All ${total} Photos with AI`;
    const statusText = isPartial
        ? `${analysed}/${total} analysed &mdash; ${remaining} ready`
        : `${total} photo${total > 1 ? "s" : ""} ready for AI analysis`;

    bar.innerHTML = `
        <div class="batch-action-ready">
            <div class="batch-action-status">${statusText}</div>
            <button class="btn-analyse-all" id="btn-analyse-all" data-event-id="${eventId}">
                ${btnLabel}
            </button>
        </div>
    `;

    document.getElementById("btn-analyse-all").addEventListener("click", () => {
        analyseAll(eventId, unanalysed.map(p => p.id));
    });
}

// ---------------------------------------------------------------------------
// Batch AI analysis — processes one-by-one with live progress UI
// ---------------------------------------------------------------------------
let _batchRunning = false;

async function analyseAll(eventId, photoIds) {
    if (_batchRunning) return;
    _batchRunning = true;

    const total        = photoIds.length;
    const progressPanel = document.getElementById("batch-progress-panel");
    const progressFill  = document.getElementById("batch-progress-fill");
    const progressLabel = document.getElementById("batch-progress-label");
    const actionBar     = document.getElementById("batch-action-bar");

    // Disable the analyse button and show progress panel
    const btn = document.getElementById("btn-analyse-all");
    if (btn) btn.disabled = true;
    if (progressPanel) progressPanel.style.display = "";

    let doneCount   = 0;
    let failCount   = 0;
    const failures  = [];

    for (let i = 0; i < photoIds.length; i++) {
        const photoId = photoIds[i];

        // Update progress UI
        const pct = Math.round((i / total) * 100);
        if (progressFill)  progressFill.style.width = `${pct}%`;
        if (progressLabel) progressLabel.textContent =
            `Analysing ${i + 1} of ${total} photos&#8230;`;

        // Mark card as "analysing" immediately
        const zone = document.getElementById(`ai-zone-${photoId}`);
        if (zone) {
            zone.innerHTML = `<span class="ai-status-chip chip-analyzing">&#129302; Analysing&#8230;</span>`;
        }

        try {
            const result = await analysePhoto(photoId);
            doneCount++;

            // Update the individual card in-place
            updateCardAfterAnalysis(photoId, result);

        } catch (err) {
            failCount++;
            failures.push({ photoId, message: err.message });

            // Show failure state on the card
            const zone2 = document.getElementById(`ai-zone-${photoId}`);
            if (zone2) {
                zone2.innerHTML = `
                    <div class="error-msg" style="font-size:11px;">&#9888; Failed: ${err.message}</div>
                    <button class="btn-analyse" data-photo-id="${photoId}">&#8635; Retry</button>
                `;
                zone2.querySelectorAll(".btn-analyse").forEach(b => {
                    b.addEventListener("click", () => runAnalysis(parseInt(b.dataset.photoId)));
                });
            }
        }
    }

    // Batch complete — update progress bar to 100%
    if (progressFill)  progressFill.style.width = "100%";
    if (progressLabel) {
        progressLabel.textContent = failCount === 0
            ? `All ${doneCount} photo${doneCount > 1 ? "s" : ""} analysed successfully.`
            : `${doneCount} of ${total} analysed. ${failCount} failed.`;
    }

    // Replace progress panel with AI summary after a short delay
    setTimeout(async () => {
        if (progressPanel) progressPanel.style.display = "none";
        _batchRunning = false;

        // Reload photos to get fresh data and re-render summary + action bar
        try {
            const photos = await getPhotosWithAnalysis(eventId);
            renderSummaryBar(photos);
            renderBatchActionBar(photos, eventId);
            renderAiCompletionBanner(photos, failCount, failures);
        } catch (_) {}

    }, 900);
}

// ---------------------------------------------------------------------------
// Update a single photo card in-place after analysis (no full gallery reload)
// ---------------------------------------------------------------------------
function updateCardAfterAnalysis(photoId, result) {
    const card = document.getElementById(`photo-card-${photoId}`);
    if (!card) return;

    // Replace the ai-zone with the full analysis zone
    const zone = document.getElementById(`ai-zone-${photoId}`);
    if (zone) {
        const newZoneHtml = renderAnalysisZone(photoId, {
            ai_recommendation:     result.ai_recommendation,
            is_blurry:             result.is_blurry,
            blur_score:            result.blur_score,
            face_detected:         result.face_detected,
            eyes_status:           result.eyes_status,
            photographer_decision: result.photographer_decision,
        });
        // Replace zone outerHTML with a temp wrapper trick
        const tmp = document.createElement("div");
        tmp.innerHTML = newZoneHtml;
        zone.replaceWith(tmp.firstElementChild);
    }

    // Remove "not analysed" chip if still present
    card.querySelectorAll(".chip-pending").forEach(el => el.remove());

    // Re-wire all listeners on this card
    card.querySelectorAll(".btn-analyse").forEach(btn => {
        btn.addEventListener("click", () => runAnalysis(parseInt(btn.dataset.photoId)));
    });
    card.querySelectorAll(".btn-decision").forEach(btn => {
        btn.addEventListener("click", () =>
            handleDecision(parseInt(btn.dataset.photoId), btn.dataset.decision)
        );
    });
}

// ---------------------------------------------------------------------------
// AI Completion Banner — shown after batch finishes
// ---------------------------------------------------------------------------
function renderAiCompletionBanner(photos, failCount, failures) {
    const bar = document.getElementById("batch-action-bar");
    if (!bar) return;

    const total      = photos.length;
    const analysed   = photos.filter(p => p.analysis !== null).length;
    const aiKeep     = photos.filter(p => p.analysis?.ai_recommendation === "keep").length;
    const aiReview   = photos.filter(p => p.analysis?.ai_recommendation === "review").length;
    const pdSelected = photos.filter(p => p.analysis?.photographer_decision === "keep").length;
    const pdRejected = photos.filter(p => p.analysis?.photographer_decision === "reject").length;
    const pdPending  = photos.filter(
        p => p.analysis !== null && p.analysis.photographer_decision === null
    ).length;

    const failNote = failCount > 0
        ? `<div class="batch-fail-note">&#9888; ${failCount} photo${failCount > 1 ? "s" : ""} failed: ${failures.map(f => `ID ${f.photoId}`).join(", ")}</div>`
        : "";

    bar.innerHTML = `
        <div class="batch-complete-panel">
            <div class="batch-complete-header">&#10024; AI ANALYSIS COMPLETE</div>
            <div class="batch-complete-counts">
                <div class="bc-group">
                    <div class="bc-group-label">AI Recommendations (${analysed} photos)</div>
                    <div class="bc-chips">
                        <span class="bc-chip bc-keep">AI Keep: ${aiKeep}</span>
                        <span class="bc-chip bc-review">AI Review: ${aiReview}</span>
                    </div>
                </div>
                <div class="bc-divider"></div>
                <div class="bc-group">
                    <div class="bc-group-label">Photographer Decisions</div>
                    <div class="bc-chips">
                        <span class="bc-chip bc-selected">Selected: ${pdSelected}</span>
                        <span class="bc-chip bc-rejected">Rejected: ${pdRejected}</span>
                        <span class="bc-chip bc-pending-d">Pending: ${pdPending}</span>
                    </div>
                </div>
            </div>
            ${failNote}
            <div class="batch-complete-note">AI recommendation and photographer decision are separate. You are always in control.</div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Rich summary bar — photo counts + AI stats + photographer stats
// ---------------------------------------------------------------------------
function renderSummaryBar(photos) {
    const bar = document.getElementById("photo-summary-bar");
    if (!bar || photos.length === 0) { if (bar) bar.innerHTML = ""; return; }

    const total    = photos.length;
    const analysed = photos.filter(p => p.analysis !== null).length;
    const selected = photos.filter(p => p.analysis?.photographer_decision === "keep").length;
    const rejected = photos.filter(p => p.analysis?.photographer_decision === "reject").length;
    const pending  = photos.filter(
        p => p.analysis !== null && p.analysis.photographer_decision === null
    ).length;

    bar.innerHTML = `
        <div class="summary-bar">
            <span class="summary-item"><strong>${total}</strong> Photos</span>
            <span class="summary-sep">|</span>
            <span class="summary-item"><strong>${analysed}/${total}</strong> Analysed</span>
            <span class="summary-sep">|</span>
            <span class="summary-item summary-keep"><strong>${selected}</strong> Selected</span>
            <span class="summary-sep">|</span>
            <span class="summary-item summary-reject"><strong>${rejected}</strong> Rejected</span>
            <span class="summary-sep">|</span>
            <span class="summary-item summary-pending"><strong>${pending}</strong> Pending decision</span>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Render a single photo card
// ---------------------------------------------------------------------------
function renderPhotoCard(photo) {
    const imgSrc = photoFileUrl(photo.id);
    const a = photo.analysis;

    let cardClass = "photo-card";
    if (a?.photographer_decision === "keep")   cardClass += " card-selected";
    if (a?.photographer_decision === "reject") cardClass += " card-rejected";

    const aiSection = a
        ? renderAnalysisZone(photo.id, a)
        : `<div class="photo-ai-zone" id="ai-zone-${photo.id}">
               <span class="ai-status-chip chip-pending">Not analysed</span>
               <button class="btn-analyse" data-photo-id="${photo.id}">&#129302; Analyse</button>
           </div>`;

    return `
        <div class="${cardClass}" id="photo-card-${photo.id}" data-photo-id="${photo.id}">
            <div class="photo-thumb-wrap">
                <img
                    class="photo-thumb"
                    src="${imgSrc}"
                    alt="${photo.original_filename}"
                    loading="lazy"
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><rect fill=%22%2322263a%22 width=%22120%22 height=%22120%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%234a4f72%22 font-size=%2224%22>IMG</text></svg>'"
                />
                ${a?.photographer_decision === "keep"
                    ? '<div class="card-decision-banner banner-keep">&#10003; Selected</div>'
                    : ""}
                ${a?.photographer_decision === "reject"
                    ? '<div class="card-decision-banner banner-reject">&#10007; Rejected</div>'
                    : ""}
            </div>
            <div class="photo-card-body">
                <div class="photo-filename" title="${photo.original_filename}">${photo.original_filename}</div>
                <div class="photo-meta">${formatBytes(photo.file_size)} &middot; ${formatDate(photo.created_at)}</div>
                ${aiSection}
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Render AI analysis zone (includes decision buttons)
// ---------------------------------------------------------------------------
function renderAnalysisZone(photoId, analysis) {
    const recClass  = analysis.ai_recommendation === "keep" ? "chip-keep" : "chip-review";
    const recLabel  = analysis.ai_recommendation === "keep" ? "&#10004; AI KEEP" : "&#9888; AI REVIEW";
    const blurLabel = analysis.is_blurry === true  ? "Blurry"
                    : analysis.is_blurry === false ? "Sharp" : "—";
    const blurClass = analysis.is_blurry === true  ? "chip-review" : "chip-keep";
    const faceLabel = analysis.face_detected === true  ? "Detected"
                    : analysis.face_detected === false ? "None" : "—";
    const eyeLabel  = analysis.eyes_status || "—";
    const blurScore = (analysis.blur_score !== null && analysis.blur_score !== undefined)
        ? analysis.blur_score.toFixed(1) : "—";

    // AI vs Photographer override indicator
    const aiRec  = analysis.ai_recommendation;
    const phoDec = analysis.photographer_decision;
    let overrideNote = "";
    if (phoDec && aiRec && phoDec !== aiRec) {
        overrideNote = `
            <div class="override-note">
                AI: <strong>${aiRec.toUpperCase()}</strong>
                &nbsp;&#8594;&nbsp;
                Photographer: <strong>${phoDec.toUpperCase()}</strong>
                <span class="override-badge">Override</span>
            </div>
        `;
    }

    const decisionHtml = renderDecisionSection(photoId, phoDec);

    return `
        <div class="photo-ai-zone" id="ai-zone-${photoId}">
            <div class="ai-label-note">AI recommendation &mdash; photographer decides</div>
            <div class="ai-result-grid">
                <span class="ai-result-chip ${recClass}">${recLabel}</span>
                <span class="ai-result-chip ${blurClass}">&#128269; ${blurLabel} (${blurScore})</span>
                <span class="ai-result-chip chip-neutral">&#128578; Face: ${faceLabel}</span>
                <span class="ai-result-chip chip-neutral">&#128065; Eyes: ${eyeLabel}</span>
            </div>
            ${overrideNote}
            <button class="btn-analyse btn-analyse-again" data-photo-id="${photoId}">&#8635; Re-analyse</button>
            ${decisionHtml}
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Render photographer decision section
// ---------------------------------------------------------------------------
function renderDecisionSection(photoId, currentDecision) {
    const decided = currentDecision !== null && currentDecision !== undefined;

    if (!decided) {
        return `
            <div class="decision-zone" id="decision-zone-${photoId}">
                <div class="decision-label">Photographer decision</div>
                <div class="decision-buttons">
                    <button class="btn-decision btn-keep" data-photo-id="${photoId}" data-decision="keep">
                        &#10003; Keep
                    </button>
                    <button class="btn-decision btn-reject" data-photo-id="${photoId}" data-decision="reject">
                        &#10007; Reject
                    </button>
                </div>
            </div>
        `;
    }

    const isKeep       = currentDecision === "keep";
    const decisionChip = isKeep
        ? `<span class="decision-chip chip-decided-keep">&#10003; Photographer: KEEP</span>`
        : `<span class="decision-chip chip-decided-reject">&#10007; Photographer: REJECT</span>`;
    const changeBtn = isKeep
        ? `<button class="btn-decision btn-reject btn-change-decision" data-photo-id="${photoId}" data-decision="reject">Change to Reject</button>`
        : `<button class="btn-decision btn-keep btn-change-decision" data-photo-id="${photoId}" data-decision="keep">Change to Keep</button>`;

    return `
        <div class="decision-zone" id="decision-zone-${photoId}">
            <div class="decision-label">Photographer decision</div>
            ${decisionChip}
            ${changeBtn}
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Attach all event listeners to gallery
// ---------------------------------------------------------------------------
function attachAllCardListeners(gallery) {
    gallery.querySelectorAll(".btn-analyse").forEach(btn => {
        btn.addEventListener("click", () => runAnalysis(parseInt(btn.dataset.photoId)));
    });
    gallery.querySelectorAll(".btn-decision").forEach(btn => {
        btn.addEventListener("click", () =>
            handleDecision(parseInt(btn.dataset.photoId), btn.dataset.decision)
        );
    });
}

// ---------------------------------------------------------------------------
// Individual photo analysis (Re-analyse / single card)
// ---------------------------------------------------------------------------
async function runAnalysis(photoId) {
    const zone = document.getElementById(`ai-zone-${photoId}`);
    if (!zone) return;

    zone.innerHTML = `<span class="ai-status-chip chip-analyzing">&#129302; Analysing&#8230;</span>`;

    try {
        const result = await analysePhoto(photoId);
        updateCardAfterAnalysis(photoId, result);
        refreshSummaryAndActionBar();
    } catch (err) {
        const zone2 = document.getElementById(`ai-zone-${photoId}`);
        if (zone2) {
            zone2.innerHTML = `
                <div class="error-msg" style="font-size:12px;">&#9888; Analysis failed: ${err.message}</div>
                <button class="btn-analyse" data-photo-id="${photoId}">&#8635; Retry</button>
            `;
            zone2.querySelectorAll(".btn-analyse").forEach(btn => {
                btn.addEventListener("click", () => runAnalysis(parseInt(btn.dataset.photoId)));
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Handle photographer decision
// ---------------------------------------------------------------------------
async function handleDecision(photoId, decision) {
    const decisionZone = document.getElementById(`decision-zone-${photoId}`);
    if (!decisionZone) return;

    decisionZone.querySelectorAll("button").forEach(b => b.disabled = true);
    const oldHtml = decisionZone.innerHTML;
    decisionZone.innerHTML += `<span class="saving-indicator">Saving&#8230;</span>`;

    try {
        const result = await setDecision(photoId, decision);

        decisionZone.outerHTML = renderDecisionSection(photoId, result.photographer_decision);

        const card = document.getElementById(`photo-card-${photoId}`);
        if (card) {
            card.classList.remove("card-selected", "card-rejected");
            if (result.photographer_decision === "keep")   card.classList.add("card-selected");
            if (result.photographer_decision === "reject") card.classList.add("card-rejected");

            const thumbWrap = card.querySelector(".photo-thumb-wrap");
            if (thumbWrap) {
                thumbWrap.querySelectorAll(".card-decision-banner").forEach(b => b.remove());
                if (result.photographer_decision === "keep") {
                    thumbWrap.insertAdjacentHTML("beforeend",
                        '<div class="card-decision-banner banner-keep">&#10003; Selected</div>');
                } else if (result.photographer_decision === "reject") {
                    thumbWrap.insertAdjacentHTML("beforeend",
                        '<div class="card-decision-banner banner-reject">&#10007; Rejected</div>');
                }
            }

            // Also update override note inside the ai-zone if rec and decision now differ
            const aiZone = document.getElementById(`ai-zone-${photoId}`);
            if (aiZone) {
                const existingNote = aiZone.querySelector(".override-note");
                if (existingNote) existingNote.remove();

                // Determine ai_recommendation from existing chip text
                const recChip = aiZone.querySelector(".chip-keep, .chip-review");
                if (recChip) {
                    const aiRec = recChip.classList.contains("chip-keep") ? "keep" : "review";
                    const phoDec = result.photographer_decision;
                    if (phoDec && aiRec && phoDec !== aiRec) {
                        const note = document.createElement("div");
                        note.className = "override-note";
                        note.innerHTML = `AI: <strong>${aiRec.toUpperCase()}</strong> &nbsp;&#8594;&nbsp; Photographer: <strong>${phoDec.toUpperCase()}</strong> <span class="override-badge">Override</span>`;
                        recChip.parentElement.insertAdjacentElement("afterend", note);
                    }
                }
            }

            card.querySelectorAll(".btn-decision").forEach(btn => {
                btn.addEventListener("click", () =>
                    handleDecision(parseInt(btn.dataset.photoId), btn.dataset.decision)
                );
            });
        }

        refreshSummaryAndActionBar();

    } catch (err) {
        decisionZone.innerHTML = oldHtml;
        decisionZone.querySelectorAll("button").forEach(b => b.disabled = false);
        decisionZone.querySelectorAll(".btn-decision").forEach(btn => {
            btn.addEventListener("click", () =>
                handleDecision(parseInt(btn.dataset.photoId), btn.dataset.decision)
            );
        });
        decisionZone.insertAdjacentHTML("beforeend",
            `<div class="error-msg" style="font-size:12px;margin-top:6px;">&#9888; ${err.message}</div>`
        );
    }
}

// ---------------------------------------------------------------------------
// Refresh summary bar + action bar after individual actions
// ---------------------------------------------------------------------------
async function refreshSummaryAndActionBar() {
    if (!_currentEventId) return;
    try {
        const photos = await getPhotosWithAnalysis(_currentEventId);
        renderSummaryBar(photos);
        // Only update action bar if batch is not currently running
        if (!_batchRunning) renderBatchActionBar(photos, _currentEventId);
    } catch (_) { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// Final Selection panel
// ---------------------------------------------------------------------------
async function openFinalSelection(eventId) {
    const panel        = document.getElementById("final-selection-panel");
    const grid         = document.getElementById("final-selection-grid");
    const photosSection = document.getElementById("photos-section");

    photosSection.style.display = "none";
    panel.style.display = "";
    grid.innerHTML = `<div class="loading-msg">Loading final selection&#8230;</div>`;

    try {
        const photos = await getPhotosWithAnalysis(eventId);
        const kept   = photos.filter(p => p.analysis?.photographer_decision === "keep");

        if (kept.length === 0) {
            grid.innerHTML = `
                <div class="photo-empty-state">
                    <div class="photo-empty-icon">&#9733;</div>
                    <p><strong>No photos have been selected yet.</strong></p>
                    <p class="upload-hint">
                        Go back to the gallery, analyse your photos,
                        and click "Keep" on the ones you want in the final selection.
                    </p>
                </div>
            `;
            return;
        }

        // Show count header
        grid.innerHTML = `
            <div class="final-selection-header">
                <span class="decision-chip chip-decided-keep">&#10003; ${kept.length} Photo${kept.length > 1 ? "s" : ""} Selected</span>
            </div>
            ${kept.map(p => `
                <div class="final-thumb-card">
                    <div class="photo-thumb-wrap">
                        <img
                            class="photo-thumb"
                            src="${photoFileUrl(p.id)}"
                            alt="${p.original_filename}"
                            loading="lazy"
                            onerror="this.style.opacity=0.3"
                        />
                        <div class="card-decision-banner banner-keep">&#10003; Selected</div>
                    </div>
                    <div class="photo-card-body">
                        <div class="photo-filename" title="${p.original_filename}">${p.original_filename}</div>
                        <div class="photo-meta">${formatBytes(p.file_size)}</div>
                        <span class="decision-chip chip-decided-keep">&#10003; Photographer: KEEP</span>
                        ${p.analysis?.ai_recommendation ? `<span class="ai-result-chip ${p.analysis.ai_recommendation === "keep" ? "chip-keep" : "chip-review"}" style="font-size:10px;margin-top:4px;">AI: ${p.analysis.ai_recommendation.toUpperCase()}</span>` : ""}
                    </div>
                </div>
            `).join("")}
        `;

    } catch (err) {
        grid.innerHTML = `<div class="error-msg">&#9888; ${err.message}</div>`;
    }
}

// ---------------------------------------------------------------------------
// Handle file upload
// ---------------------------------------------------------------------------
async function handleUpload(eventId) {
    const fileInput    = document.getElementById("photo-file-input");
    const progressArea = document.getElementById("upload-progress-area");
    const files        = Array.from(fileInput.files);

    if (files.length === 0) {
        progressArea.innerHTML = `<div class="error-msg">&#9888; Please select at least one photo first.</div>`;
        return;
    }

    progressArea.innerHTML = files.map((f, i) => `
        <div class="upload-row" id="upload-row-${i}">
            <span class="upload-row-name">${f.name}</span>
            <span class="upload-row-status status-uploading" id="upload-status-${i}">Uploading&#8230;</span>
        </div>
    `).join("");

    let successCount = 0;
    let failCount    = 0;

    for (let i = 0; i < files.length; i++) {
        const file     = files[i];
        const statusEl = document.getElementById(`upload-status-${i}`);

        const ext = file.name.split(".").pop().toLowerCase();
        if (!["jpg", "jpeg", "png"].includes(ext)) {
            statusEl.textContent = "Not a JPG/PNG";
            statusEl.className   = "upload-row-status status-error";
            failCount++;
            continue;
        }

        try {
            await uploadPhoto(eventId, file);
            statusEl.textContent = "Uploaded";
            statusEl.className   = "upload-row-status status-success";
            successCount++;
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className   = "upload-row-status status-error";
            failCount++;
        }
    }

    const summary = document.createElement("div");
    summary.className   = successCount > 0 ? "upload-summary success" : "upload-summary error";
    summary.textContent = `${successCount} uploaded, ${failCount} failed.`;
    progressArea.appendChild(summary);

    fileInput.value = "";
    document.getElementById("upload-file-label").textContent = "No files selected";

    if (successCount > 0) {
        await loadPhotoGallery(eventId);
    }
}

// ---------------------------------------------------------------------------
// Clients list
// ---------------------------------------------------------------------------
async function loadClients() {
    const container = document.getElementById("clients-list");
    showLoading("clients-list");
    try {
        const clients = await getClients();
        if (clients.length === 0) {
            container.innerHTML = `<p class="empty-msg">No clients yet. Use the form above to create one.</p>`;
            return;
        }
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Added</th></tr>
                </thead>
                <tbody>
                    ${clients.map(c => `
                        <tr>
                            <td>${c.id}</td>
                            <td>${c.name}</td>
                            <td>${c.email}</td>
                            <td>${c.phone || "—"}</td>
                            <td>${formatDate(c.created_at)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        showError("clients-list", err.message);
        console.error("[Clients]", err);
    }
}

// ---------------------------------------------------------------------------
// Bookings list
// ---------------------------------------------------------------------------
async function loadBookings() {
    const container = document.getElementById("bookings-list");
    showLoading("bookings-list");
    try {
        await populateBookingClientSelect();
        const bookings = await getBookings();
        if (bookings.length === 0) {
            container.innerHTML = `<p class="empty-msg">No bookings yet. Use the form above to create one.</p>`;
            return;
        }
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr><th>#</th><th>Title</th><th>Booking Date</th><th>Status</th><th>Notes</th></tr>
                </thead>
                <tbody>
                    ${bookings.map(b => `
                        <tr>
                            <td>${b.id}</td>
                            <td>${b.title}</td>
                            <td>${formatDate(b.booking_date)}</td>
                            <td>${statusBadge(b.status)}</td>
                            <td>${b.notes || "—"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        showError("bookings-list", err.message);
        console.error("[Bookings]", err);
    }
}

// ---------------------------------------------------------------------------
// Create Client / Booking / Event
// ---------------------------------------------------------------------------
function todayLocalIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function optionalText(value) {
    const trimmed = (value || "").trim();
    return trimmed ? trimmed : null;
}

function showFormError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!message) {
        el.hidden = true;
        el.textContent = "";
        return;
    }
    el.hidden = false;
    el.textContent = message;
}

function setFormBusy(form, busy) {
    form.querySelectorAll("input, select, textarea, button").forEach(el => {
        el.disabled = busy;
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function populateBookingClientSelect() {
    const select = document.getElementById("booking-client");
    if (!select) return;

    try {
        const clients = await getClients();
        if (clients.length === 0) {
            select.innerHTML = `<option value="">Create a client first</option>`;
            return;
        }

        const preferred = pendingBookingClientId != null
            ? String(pendingBookingClientId)
            : select.value;

        select.innerHTML = clients.map(c =>
            `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.email)})</option>`
        ).join("");

        if (preferred && clients.some(c => String(c.id) === preferred)) {
            select.value = preferred;
        }
    } catch (err) {
        select.innerHTML = `<option value="">Could not load clients</option>`;
        showFormError("booking-form-error", err.message);
        console.error("[BookingClientSelect]", err);
    }
}

async function populateEventBookingSelect() {
    const select = document.getElementById("event-booking");
    if (!select) return;

    try {
        const bookings = await getBookings();
        if (bookings.length === 0) {
            select.innerHTML = `<option value="">Create a booking first</option>`;
            return;
        }

        const preferred = pendingEventBookingId != null
            ? String(pendingEventBookingId)
            : select.value;

        select.innerHTML = bookings.map(b =>
            `<option value="${b.id}">#${b.id} — ${escapeHtml(b.title)} (${formatDate(b.booking_date)})</option>`
        ).join("");

        if (preferred && bookings.some(b => String(b.id) === preferred)) {
            select.value = preferred;
        }
    } catch (err) {
        select.innerHTML = `<option value="">Could not load bookings</option>`;
        showFormError("event-form-error", err.message);
        console.error("[EventBookingSelect]", err);
    }
}

async function handleCreateClient(e) {
    e.preventDefault();
    const form = e.currentTarget;
    showFormError("client-form-error", "");
    setFormBusy(form, true);

    try {
        const created = await createClient({
            name: document.getElementById("client-name").value,
            email: document.getElementById("client-email").value,
            phone: optionalText(document.getElementById("client-phone").value),
            notes: optionalText(document.getElementById("client-notes").value),
        });
        pendingBookingClientId = created.id;
        form.reset();
        showSection("section-bookings");
    } catch (err) {
        showFormError("client-form-error", err.message);
        console.error("[CreateClient]", err);
    } finally {
        setFormBusy(form, false);
    }
}

async function handleCreateBooking(e) {
    e.preventDefault();
    const form = e.currentTarget;
    showFormError("booking-form-error", "");

    const clientId = document.getElementById("booking-client").value;
    if (!clientId) {
        showFormError("booking-form-error", "Create a client first, then choose them here.");
        return;
    }

    setFormBusy(form, true);
    try {
        const created = await createBooking({
            client_id: Number(clientId),
            title: document.getElementById("booking-title").value,
            booking_date: document.getElementById("booking-date").value,
            status: document.getElementById("booking-status").value,
            notes: optionalText(document.getElementById("booking-notes").value),
        });
        pendingEventBookingId = created.id;
        pendingBookingClientId = null;
        form.reset();
        document.getElementById("booking-date").value = todayLocalIso();
        document.getElementById("booking-status").value = "confirmed";
        showSection("section-events");
    } catch (err) {
        showFormError("booking-form-error", err.message);
        console.error("[CreateBooking]", err);
    } finally {
        setFormBusy(form, false);
    }
}

async function handleCreateEvent(e) {
    e.preventDefault();
    const form = e.currentTarget;
    showFormError("event-form-error", "");

    const bookingId = document.getElementById("event-booking").value;
    if (!bookingId) {
        showFormError("event-form-error", "Create a booking first, then choose it here.");
        return;
    }

    setFormBusy(form, true);
    try {
        const created = await createEvent({
            booking_id: Number(bookingId),
            name: document.getElementById("event-name").value,
            event_date: document.getElementById("event-date").value,
            location: optionalText(document.getElementById("event-location").value),
            status: document.getElementById("event-status").value,
        });
        pendingEventBookingId = null;
        form.reset();
        document.getElementById("event-date").value = todayLocalIso();
        document.getElementById("event-status").value = "scheduled";
        await openEventDetail(created.id);
    } catch (err) {
        showFormError("event-form-error", err.message);
        console.error("[CreateEvent]", err);
    } finally {
        setFormBusy(form, false);
    }
}

function wireCreateForms() {
    const clientForm = document.getElementById("form-create-client");
    const bookingForm = document.getElementById("form-create-booking");
    const eventForm = document.getElementById("form-create-event");

    if (clientForm) clientForm.addEventListener("submit", handleCreateClient);
    if (bookingForm) bookingForm.addEventListener("submit", handleCreateBooking);
    if (eventForm) eventForm.addEventListener("submit", handleCreateEvent);

    const bookingDate = document.getElementById("booking-date");
    const eventDate = document.getElementById("event-date");
    if (bookingDate && !bookingDate.value) bookingDate.value = todayLocalIso();
    if (eventDate && !eventDate.value) eventDate.value = todayLocalIso();

    const dashClient = document.getElementById("dash-goto-client");
    const dashBooking = document.getElementById("dash-goto-booking");
    const dashEvent = document.getElementById("dash-goto-event");
    if (dashClient) dashClient.addEventListener("click", () => showSection("section-clients"));
    if (dashBooking) dashBooking.addEventListener("click", () => showSection("section-bookings"));
    if (dashEvent) dashEvent.addEventListener("click", () => showSection("section-events"));
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
wireCreateForms();
showSection("section-dashboard");
