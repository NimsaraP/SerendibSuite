/**
 * app.js — SerendibSuite Photographer Dashboard
 *
 * Single-page application logic.
 * Handles navigation, data fetching, and rendering all views.
 */

import {
    API_BASE,
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
    getBurstGroups,
    getPersonalizationInsights,
    xmpExportUrl,
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
    if (sectionId === "section-photos")   loadAllPhotos();
    if (sectionId === "section-ai-insights") loadPersonalizationInsights();
}

// Mobile navigation drawer toggle
const mobileMenuBtn = document.getElementById("btn-mobile-menu");
const sidebarCloseBtn = document.getElementById("btn-sidebar-close");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const sidebar = document.getElementById("sidebar");

function openSidebar() {
    if (sidebar) sidebar.classList.add("open");
    if (sidebarBackdrop) sidebarBackdrop.classList.add("open");
    document.body.classList.add("sidebar-open");
}

function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("open");
    document.body.classList.remove("sidebar-open");
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openSidebar);
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", closeSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

navLinks.forEach(link => {
    link.addEventListener("click", e => {
        e.preventDefault();
        showSection(link.dataset.section);
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
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

function formatTime(timeStr) {
    if (!timeStr) return "";
    const trimmed = String(timeStr).trim();
    if (/am|pm/i.test(trimmed)) {
        return trimmed;
    }
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const strH = String(hours).padStart(2, "0");
        return `${strH}:${minutes} ${ampm}`;
    }
    return trimmed;
}

function getRelativeScheduleBadge(eventDateIso) {
    if (!eventDateIso) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const evDate = new Date(eventDateIso.length === 10 ? eventDateIso + "T00:00:00" : eventDateIso);
    evDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((evDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return `<span class="badge badge-yellow">🔔 TODAY</span>`;
    }
    if (diffDays === 1) {
        return `<span class="badge badge-yellow">⚡ TOMORROW</span>`;
    }
    if (diffDays > 1 && diffDays <= 7) {
        return `<span class="badge badge-blue">⏳ In ${diffDays} days</span>`;
    }
    if (diffDays > 7) {
        return `<span class="badge badge-gray">In ${diffDays} days</span>`;
    }
    return `<span class="badge badge-gray">Past (${Math.abs(diffDays)}d ago)</span>`;
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Separate into upcoming and past events
        const upcomingEvents = [];
        const pastEvents = [];

        events.forEach(e => {
            const evDate = new Date(e.event_date.length === 10 ? e.event_date + "T00:00:00" : e.event_date);
            evDate.setHours(0, 0, 0, 0);
            const diffDays = Math.round((evDate - today) / (1000 * 60 * 60 * 24));
            e._diffDays = diffDays;
            if (diffDays >= 0 && e.status !== "cancelled") {
                upcomingEvents.push(e);
            } else {
                pastEvents.push(e);
            }
        });

        // Sort upcoming: ASCENDING (closest upcoming to today first!)
        upcomingEvents.sort((a, b) => {
            if (a._diffDays !== b._diffDays) return a._diffDays - b._diffDays;
            return (a.event_time || "").localeCompare(b.event_time || "");
        });

        // Sort past: DESCENDING (most recent past event first)
        pastEvents.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

        // Prioritize closest upcoming events, fill with past if less than 5
        const prioritized = [...upcomingEvents, ...pastEvents].slice(0, 6);

        const container = document.getElementById("recent-events-list");
        if (prioritized.length === 0) {
            container.innerHTML = `<p class="empty-msg">No events yet. Create one to get started.</p>`;
        } else {
            container.innerHTML = prioritized.map(ev => `
                <div class="recent-event-item" data-id="${ev.id}">
                    <div class="rei-header">
                        <div class="rei-name">${escapeHtml(ev.name)}</div>
                        <div class="rei-pills">
                            ${getRelativeScheduleBadge(ev.event_date)}
                            ${statusBadge(ev.status)}
                        </div>
                    </div>
                    <div class="rei-meta">
                        <span class="rei-meta-item">📅 ${formatDate(ev.event_date)}</span>
                        ${ev.event_time ? `<span class="rei-meta-item rei-time">⏰ ${escapeHtml(formatTime(ev.event_time))}</span>` : ""}
                        <span class="rei-meta-item">📍 ${escapeHtml(ev.location || "Location TBD")}</span>
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Sort events so closest upcoming events are placed first
        const sortedEvents = [...events].sort((a, b) => {
            const dA = new Date(a.event_date.length === 10 ? a.event_date + "T00:00:00" : a.event_date);
            const dB = new Date(b.event_date.length === 10 ? b.event_date + "T00:00:00" : b.event_date);
            return dA - dB;
        });

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Event Name</th>
                        <th>Date &amp; Time</th>
                        <th>Timing</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedEvents.map(ev => `
                        <tr>
                            <td>${ev.id}</td>
                            <td><strong>${escapeHtml(ev.name)}</strong></td>
                            <td>
                                <div><strong>${formatDate(ev.event_date)}</strong></div>
                                ${ev.event_time ? `<div class="event-time-pill">⏰ ${escapeHtml(formatTime(ev.event_time))}</div>` : '<div class="stat-hint">—</div>'}
                            </td>
                            <td>${getRelativeScheduleBadge(ev.event_date)}</td>
                            <td>${escapeHtml(ev.location || "—")}</td>
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
                    <div class="detail-row"><span>Name</span><strong>${escapeHtml(ev.name)}</strong></div>
                    <div class="detail-row"><span>Date</span><strong>${formatDate(ev.event_date)}</strong></div>
                    <div class="detail-row"><span>Time</span><strong>${ev.event_time ? "⏰ " + escapeHtml(formatTime(ev.event_time)) : "—"}</strong></div>
                    <div class="detail-row"><span>Timing</span>${getRelativeScheduleBadge(ev.event_date)}</div>
                    <div class="detail-row"><span>Location</span><strong>${escapeHtml(ev.location || "—")}</strong></div>
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

                    <!-- ── Header row: title + actions ── -->
                    <div class="photos-header">
                        <h3>&#128444; Photos <span class="photo-count-badge" id="photo-count-badge"></span></h3>
                        <div class="photos-header-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn-xmp-export" id="btn-export-xmp" title="Export XMP sidecar files for Adobe Lightroom / Photo Mechanic">
                                &#128190; Export to Lightroom (XMP)
                            </button>
                            <button class="btn-burst-view" id="btn-view-bursts" title="Cluster near-duplicate burst shots and pick best frame">
                                &#9638; Duplicate Bursts
                            </button>
                            <button class="btn-final-selection" id="btn-final-selection">
                                &#9733; View Final Selection
                            </button>
                        </div>
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
                    <div class="upload-bar" id="upload-dropzone">
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
                        <span class="upload-file-label" id="upload-file-label">Select photo or drag &amp; drop here (JPG, PNG up to 50MB)</span>
                    </div>

                    <!-- ── Upload progress rows ── -->
                    <div id="upload-progress-area"></div>

                    <!-- ── Photo gallery grid ── -->
                    <div class="photo-gallery" id="photo-gallery">
                        <div class="loading-msg">Loading photos&#8230;</div>
                    </div>
                </div>

                <!-- Burst / Duplicate Groups panel (hidden by default) -->
                <div class="detail-card full-width burst-groups-panel" id="burst-groups-panel" style="display:none">
                    <div class="photos-header">
                        <div>
                            <h3>&#9638; Burst &amp; Duplicate Groups</h3>
                            <p class="create-panel-hint" style="margin: 4px 0 0 0;">Near-duplicate sequences grouped by perceptual similarity (pHash). The AI identifies the top pick frame based on sharpness and eye expression.</p>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn-back-gallery" id="btn-back-from-bursts">
                                &#8592; Back to All Photos
                            </button>
                        </div>
                    </div>
                    <div id="burst-groups-container">
                        <div class="loading-msg">Analyzing burst sequences&#8230;</div>
                    </div>
                </div>

                <!-- Final selection panel (hidden by default) -->
                <div class="detail-card full-width final-selection-panel" id="final-selection-panel" style="display:none">
                    <div class="photos-header">
                        <h3>&#9733; Final Selection</h3>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-xmp-export" id="btn-export-xmp-final">
                                &#128190; Export to Lightroom (XMP)
                            </button>
                            <button class="btn-back-gallery" id="btn-back-gallery">
                                &#8592; Back to Gallery
                            </button>
                        </div>
                    </div>
                    <div class="final-selection-grid" id="final-selection-grid">
                        <div class="loading-msg">Loading&#8230;</div>
                    </div>
                </div>
            </div>
        `;

        // Wire up file input & drag and drop
        const fileInput = document.getElementById("photo-file-input");
        const fileLabel = document.getElementById("upload-file-label");
        const uploadBtn = document.getElementById("btn-upload-photos");
        const dropZone = document.getElementById("upload-dropzone");

        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files.length > 0) {
                fileLabel.textContent = `${fileInput.files.length} photo${fileInput.files.length > 1 ? "s" : ""} uploading...`;
                handleUpload(eventId, fileInput.files);
            }
        });

        uploadBtn.addEventListener("click", () => {
            if (fileInput.files && fileInput.files.length > 0) {
                handleUpload(eventId, fileInput.files);
            } else {
                fileInput.click();
            }
        });

        if (dropZone) {
            ["dragenter", "dragover"].forEach(evt => {
                dropZone.addEventListener(evt, e => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add("drag-over");
                });
            });
            ["dragleave", "drop"].forEach(evt => {
                dropZone.addEventListener(evt, e => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove("drag-over");
                });
            });
            dropZone.addEventListener("drop", e => {
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleUpload(eventId, e.dataTransfer.files);
                }
            });
        }

        // Final selection toggle
        document.getElementById("btn-final-selection").addEventListener("click", () => {
            openFinalSelection(eventId);
        });
        document.getElementById("btn-back-gallery").addEventListener("click", () => {
            document.getElementById("final-selection-panel").style.display = "none";
            document.getElementById("burst-groups-panel").style.display = "none";
            document.getElementById("photos-section").style.display = "";
        });

        // Duplicate bursts toggle
        document.getElementById("btn-view-bursts").addEventListener("click", () => {
            openBurstGroups(eventId);
        });
        document.getElementById("btn-back-from-bursts").addEventListener("click", () => {
            document.getElementById("burst-groups-panel").style.display = "none";
            document.getElementById("photos-section").style.display = "";
        });

        // XMP Export buttons
        const handleXmpExport = () => {
            window.location.href = xmpExportUrl(eventId);
        };
        document.getElementById("btn-export-xmp").addEventListener("click", handleXmpExport);
        document.getElementById("btn-export-xmp-final").addEventListener("click", handleXmpExport);

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
async function handleUpload(eventId, filesToUpload = null) {
    const fileInput    = document.getElementById("photo-file-input");
    const progressArea = document.getElementById("upload-progress-area");
    const rawFiles     = filesToUpload || (fileInput ? fileInput.files : null);
    const files        = rawFiles ? Array.from(rawFiles) : [];

    if (files.length === 0) {
        showToast("Please select at least one photo first.", "error");
        progressArea.innerHTML = `<div class="error-msg">&#9888; Please select at least one photo first.</div>`;
        return;
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_EXTS = ["jpg", "jpeg", "png"];

    // Render upload rows with local thumbnail preview
    progressArea.innerHTML = files.map((f, i) => {
        let previewSrc = "";
        try {
            previewSrc = URL.createObjectURL(f);
        } catch (_) {}

        return `
            <div class="upload-row" id="upload-row-${i}">
                <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                    ${previewSrc ? `<img src="${previewSrc}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid var(--color-border);" />` : ""}
                    <span class="upload-row-name">${escapeHtml(f.name)} (${formatBytes(f.size)})</span>
                </div>
                <span class="upload-row-status status-uploading" id="upload-status-${i}">Uploading&#8230;</span>
            </div>
        `;
    }).join("");

    let successCount = 0;
    let failCount    = 0;

    for (let i = 0; i < files.length; i++) {
        const file     = files[i];
        const statusEl = document.getElementById(`upload-status-${i}`);

        const ext = file.name.split(".").pop().toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) {
            if (statusEl) {
                statusEl.textContent = "Unsupported format (only JPG/PNG allowed)";
                statusEl.className   = "upload-row-status status-error";
            }
            failCount++;
            continue;
        }

        if (file.size === 0) {
            if (statusEl) {
                statusEl.textContent = "File is empty (0 bytes)";
                statusEl.className   = "upload-row-status status-error";
            }
            failCount++;
            continue;
        }

        if (file.size > MAX_FILE_SIZE) {
            if (statusEl) {
                statusEl.textContent = `Exceeds 50MB limit (${formatBytes(file.size)})`;
                statusEl.className   = "upload-row-status status-error";
            }
            failCount++;
            continue;
        }

        try {
            await uploadPhoto(eventId, file);
            if (statusEl) {
                statusEl.textContent = "Uploaded \u2713";
                statusEl.className   = "upload-row-status status-success";
            }
            successCount++;
        } catch (err) {
            if (statusEl) {
                statusEl.textContent = err.message;
                statusEl.className   = "upload-row-status status-error";
            }
            failCount++;
        }
    }

    const summary = document.createElement("div");
    summary.className   = successCount > 0 ? "upload-summary success" : "upload-summary error";
    summary.textContent = `${successCount} uploaded, ${failCount} failed.`;
    progressArea.appendChild(summary);

    if (successCount > 0 && failCount === 0) {
        showToast(`Successfully uploaded ${successCount} photo${successCount > 1 ? "s" : ""}!`);
    } else if (successCount > 0 && failCount > 0) {
        showToast(`Uploaded ${successCount} photos, but ${failCount} failed.`, "error");
    } else if (failCount > 0) {
        showToast(`Upload failed for all ${failCount} photos.`, "error");
    }

    if (fileInput) fileInput.value = "";
    const labelEl = document.getElementById("upload-file-label");
    if (labelEl) labelEl.textContent = "Select photo or drag & drop here (JPG, PNG up to 50MB)";

    if (successCount > 0) {
        await loadPhotoGallery(eventId);
        setTimeout(() => {
            if (progressArea) progressArea.innerHTML = "";
        }, 2500);
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

// ---------------------------------------------------------------------------
// Form Validation Helpers & Toast UI
// ---------------------------------------------------------------------------
function validateClientName(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) {
        return { valid: false, error: "Client name is required." };
    }
    if (trimmed.length < 2) {
        return { valid: false, error: "Client name must be at least 2 characters." };
    }
    if (trimmed.length > 100) {
        return { valid: false, error: "Client name cannot exceed 100 characters." };
    }
    if (/\d/.test(trimmed)) {
        return { valid: false, error: "Client name cannot contain numbers. Only letters are allowed (e.g. Ruwan Perera)." };
    }
    if (!/^[A-Za-z\s\.\'\-]+$/.test(trimmed)) {
        return { valid: false, error: "Client name can only contain letters, spaces, hyphens, and apostrophes." };
    }
    return { valid: true, error: null };
}

function validateClientEmail(email) {
    const trimmed = (email || "").trim();
    if (!trimmed) {
        return { valid: false, error: "Email address is required." };
    }
    if (/\s/.test(trimmed)) {
        return { valid: false, error: "Email address cannot contain spaces." };
    }
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!re.test(trimmed)) {
        return { valid: false, error: "Please enter a valid email address (e.g. client@example.com)." };
    }
    return { valid: true, error: null };
}

function validateClientPhone(phone) {
    if (!phone || !phone.trim()) {
        return { valid: true, error: null }; // Phone is optional
    }
    const trimmed = phone.trim();
    if (/[a-zA-Z]/.test(trimmed)) {
        return { valid: false, error: "Phone number cannot contain letters. Numbers only (e.g. +94 77 123 4567)." };
    }
    if (!/^\+?[0-9\s\-\(\)]+$/.test(trimmed)) {
        return { valid: false, error: "Phone number contains invalid characters. Only digits, +, -, and spaces are allowed." };
    }
    const digits = trimmed.replace(/[^0-9]/g, "");
    if (digits.length < 9 || digits.length > 15) {
        return { valid: false, error: "Phone number must contain between 9 and 15 digits (e.g. +94 77 123 4567)." };
    }
    return { valid: true, error: null };
}

function isValidName(name) {
    return validateClientName(name).valid;
}

function isValidEmail(email) {
    return validateClientEmail(email).valid;
}

function isValidPhone(phone) {
    return validateClientPhone(phone).valid;
}

function setInputError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add("input-error");
    let errEl = inputEl.parentElement.querySelector(".field-error-msg");
    if (!errEl) {
        errEl = document.createElement("span");
        errEl.className = "field-error-msg";
        inputEl.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;
}

function clearInputError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove("input-error");
    const errEl = inputEl.parentElement.querySelector(".field-error-msg");
    if (errEl) errEl.remove();
}

function clearAllFormErrors(form) {
    form.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    form.querySelectorAll(".field-error-msg").forEach(el => el.remove());
}

function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "success" ? "&#10003;" : "&#9888;";
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400);
    }, 3800);
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

        select.innerHTML = `<option value="">-- Choose Client --</option>` + clients.map(c =>
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

        select.innerHTML = `<option value="">-- Choose Booking --</option>` + bookings.map(b =>
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
    clearAllFormErrors(form);

    const nameInput = document.getElementById("client-name");
    const emailInput = document.getElementById("client-email");
    const phoneInput = document.getElementById("client-phone");
    const notesInput = document.getElementById("client-notes");

    const nameVal = nameInput.value.trim();
    const emailVal = emailInput.value.trim();
    const phoneVal = phoneInput.value.trim();
    const notesVal = notesInput.value.trim();

    let hasError = false;
    let firstErrorEl = null;

    // Validate Name (no digits allowed, letters only)
    const nameCheck = validateClientName(nameVal);
    if (!nameCheck.valid) {
        setInputError(nameInput, nameCheck.error);
        hasError = true;
        if (!firstErrorEl) firstErrorEl = nameInput;
    }

    // Validate Email (proper email format)
    const emailCheck = validateClientEmail(emailVal);
    if (!emailCheck.valid) {
        setInputError(emailInput, emailCheck.error);
        hasError = true;
        if (!firstErrorEl) firstErrorEl = emailInput;
    }

    // Validate Phone (optional, but no letters allowed, 9-15 digits)
    if (phoneVal) {
        const phoneCheck = validateClientPhone(phoneVal);
        if (!phoneCheck.valid) {
            setInputError(phoneInput, phoneCheck.error);
            hasError = true;
            if (!firstErrorEl) firstErrorEl = phoneInput;
        }
    }

    // Validate Notes
    if (notesVal && notesVal.length > 1000) {
        setInputError(notesInput, "Notes cannot exceed 1000 characters.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = notesInput;
    }

    if (hasError) {
        if (firstErrorEl) firstErrorEl.focus();
        showToast("Please correct the form errors before submitting.", "error");
        return;
    }

    setFormBusy(form, true);

    try {
        const created = await createClient({
            name: nameVal,
            email: emailVal,
            phone: optionalText(phoneVal),
            notes: optionalText(notesVal),
        });
        pendingBookingClientId = created.id;
        form.reset();
        clearAllFormErrors(form);
        showToast(`Client "${created.name}" created successfully!`);
        showSection("section-bookings");
    } catch (err) {
        const msg = err.message || "Failed to create client";
        showFormError("client-form-error", msg);
        showToast(msg, "error");
        console.error("[CreateClient]", err);
        const lower = msg.toLowerCase();
        if (lower.includes("name")) {
            setInputError(nameInput, msg);
            nameInput.focus();
        } else if (lower.includes("email")) {
            setInputError(emailInput, msg);
            emailInput.focus();
        } else if (lower.includes("phone")) {
            setInputError(phoneInput, msg);
            phoneInput.focus();
        }
    } finally {
        setFormBusy(form, false);
    }
}

async function handleCreateBooking(e) {
    e.preventDefault();
    const form = e.currentTarget;
    showFormError("booking-form-error", "");
    clearAllFormErrors(form);

    const clientSelect = document.getElementById("booking-client");
    const titleInput = document.getElementById("booking-title");
    const dateInput = document.getElementById("booking-date");
    const statusSelect = document.getElementById("booking-status");
    const notesInput = document.getElementById("booking-notes");

    const clientId = clientSelect.value;
    const titleVal = titleInput.value.trim();
    const dateVal = dateInput.value;
    const notesVal = notesInput.value.trim();

    let hasError = false;
    let firstErrorEl = null;

    // Validate Client
    if (!clientId) {
        setInputError(clientSelect, "Please select a client for this booking.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = clientSelect;
    }

    // Validate Title
    if (!titleVal) {
        setInputError(titleInput, "Booking title is required (e.g. Wedding Shoot).");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = titleInput;
    } else if (titleVal.length < 3) {
        setInputError(titleInput, "Booking title must be at least 3 characters.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = titleInput;
    } else if (titleVal.length > 200) {
        setInputError(titleInput, "Booking title cannot exceed 200 characters.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = titleInput;
    }

    // Validate Date
    if (!dateVal) {
        setInputError(dateInput, "Booking date is required.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = dateInput;
    }

    // Validate Notes
    if (notesVal && notesVal.length > 1000) {
        setInputError(notesInput, "Notes cannot exceed 1000 characters.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = notesInput;
    }

    if (hasError) {
        if (firstErrorEl) firstErrorEl.focus();
        showToast("Please fill in all required booking fields correctly.", "error");
        return;
    }

    setFormBusy(form, true);
    try {
        const created = await createBooking({
            client_id: Number(clientId),
            title: titleVal,
            booking_date: dateVal,
            status: statusSelect.value,
            notes: optionalText(notesVal),
        });
        pendingEventBookingId = created.id;
        pendingBookingClientId = null;
        form.reset();
        clearAllFormErrors(form);
        document.getElementById("booking-date").value = todayLocalIso();
        document.getElementById("booking-status").value = "confirmed";
        showToast(`Booking "${created.title}" created successfully!`);
        showSection("section-events");
    } catch (err) {
        const msg = err.message || "Failed to create booking";
        showFormError("booking-form-error", msg);
        showToast(msg, "error");
        console.error("[CreateBooking]", err);
    } finally {
        setFormBusy(form, false);
    }
}

async function handleCreateEvent(e) {
    e.preventDefault();
    const form = e.currentTarget;
    showFormError("event-form-error", "");
    clearAllFormErrors(form);

    const bookingSelect = document.getElementById("event-booking");
    const nameInput = document.getElementById("event-name");
    const dateInput = document.getElementById("event-date");
    const timeInput = document.getElementById("event-time");
    const locationInput = document.getElementById("event-location");
    const statusSelect = document.getElementById("event-status");

    const bookingId = bookingSelect.value;
    const nameVal = nameInput.value.trim();
    const dateVal = dateInput.value;
    const timeVal = timeInput ? timeInput.value.trim() : "";
    const locationVal = locationInput.value.trim();

    let hasError = false;
    let firstErrorEl = null;

    // Validate Booking
    if (!bookingId) {
        setInputError(bookingSelect, "Please choose an existing booking.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = bookingSelect;
    }

    // Validate Name
    if (!nameVal) {
        setInputError(nameInput, "Event name is required (e.g. Ceremony, Reception).");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = nameInput;
    } else if (nameVal.length < 2) {
        setInputError(nameInput, "Event name must be at least 2 characters.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = nameInput;
    } else if (nameVal.length > 200) {
        setInputError(nameInput, "Event name cannot exceed 200 characters.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = nameInput;
    }

    // Validate Date
    if (!dateVal) {
        setInputError(dateInput, "Event date is required.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = dateInput;
    }

    // Validate Location
    if (locationVal && locationVal.length > 255) {
        setInputError(locationInput, "Location cannot exceed 255 characters.");
        hasError = true;
        if (!firstErrorEl) firstErrorEl = locationInput;
    }

    if (hasError) {
        if (firstErrorEl) firstErrorEl.focus();
        showToast("Please fill in all required event fields correctly.", "error");
        return;
    }

    setFormBusy(form, true);
    try {
        const created = await createEvent({
            booking_id: Number(bookingId),
            name: nameVal,
            event_date: dateVal,
            event_time: optionalText(timeVal),
            location: optionalText(locationVal),
            status: statusSelect.value,
        });
        pendingEventBookingId = null;
        form.reset();
        clearAllFormErrors(form);
        document.getElementById("event-date").value = todayLocalIso();
        if (timeInput) timeInput.value = "10:00";
        document.getElementById("event-status").value = "scheduled";
        showToast(`Event "${created.name}" created successfully!`);
        await openEventDetail(created.id);
    } catch (err) {
        const msg = err.message || "Failed to create event";
        showFormError("event-form-error", msg);
        showToast(msg, "error");
        console.error("[CreateEvent]", err);
    } finally {
        setFormBusy(form, false);
    }
}

// ---------------------------------------------------------------------------
// Burst & Duplicate Groups view
// ---------------------------------------------------------------------------
async function openBurstGroups(eventId) {
    const panel = document.getElementById("burst-groups-panel");
    const container = document.getElementById("burst-groups-container");
    const photosSection = document.getElementById("photos-section");
    const finalSection = document.getElementById("final-selection-panel");

    photosSection.style.display = "none";
    finalSection.style.display = "none";
    panel.style.display = "";
    container.innerHTML = `<div class="loading-msg">Analyzing burst sequences with perceptual hashing&#8230;</div>`;

    try {
        const data = await getBurstGroups(eventId);
        if (!data.groups || data.groups.length === 0) {
            container.innerHTML = `
                <div class="photo-empty-state">
                    <div class="photo-empty-icon">&#9638;</div>
                    <p><strong>No duplicate burst sequences detected.</strong></p>
                    <p class="upload-hint">
                        All analysed photos have distinct compositions (Hamming distance &gt; 10).
                        Ensure photos are analysed with AI so perceptual hashes are registered.
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="burst-summary-banner">
                <span>Detected <strong>${data.burst_group_count}</strong> burst sequence${data.burst_group_count > 1 ? 's' : ''} (${data.total_burst_photos} total near-duplicate photos).</span>
                <span class="burst-hint">The AI identified the top pick frame based on sharpness score and open eyes.</span>
            </div>
            ${data.groups.map(g => `
                <div class="burst-group-card" id="burst-group-${g.group_id}">
                    <div class="burst-group-header">
                        <div class="bgh-title">
                            <span class="burst-badge">Burst #${g.group_id}</span>
                            <span>${g.count} near-duplicate frames</span>
                        </div>
                        <button class="btn-keep-best" data-group-id="${g.group_id}" data-pick-id="${g.top_pick_id}">
                            &#9733; Keep Top Pick &amp; Reject Others
                        </button>
                    </div>
                    <div class="burst-photos-grid">
                        ${g.photos.map(p => {
                            const isTop = p.is_top_pick;
                            const dec = p.analysis?.photographer_decision;
                            let cardStyle = isTop ? "burst-photo-item top-pick-frame" : "burst-photo-item";
                            return `
                                <div class="${cardStyle}" id="burst-card-${p.id}">
                                    <div class="photo-thumb-wrap">
                                        <img src="${photoFileUrl(p.id)}" alt="${p.original_filename}" loading="lazy" />
                                        ${isTop ? '<div class="top-pick-badge">&#9733; AI TOP PICK</div>' : ''}
                                        ${dec === 'keep' ? '<div class="card-decision-banner banner-keep">&#10003; Selected</div>' : ''}
                                        ${dec === 'reject' ? '<div class="card-decision-banner banner-reject">&#10007; Rejected</div>' : ''}
                                    </div>
                                    <div class="burst-photo-info">
                                        <div class="burst-filename" title="${p.original_filename}">${p.original_filename}</div>
                                        <div class="burst-stats">
                                            <span>&#128269; Sharpness: ${p.analysis?.blur_score ? p.analysis.blur_score.toFixed(1) : '—'}</span>
                                            <span>&#128065; Eyes: ${p.analysis?.eyes_status || '—'}</span>
                                        </div>
                                        <div class="burst-btn-group">
                                            <button class="btn-decision btn-keep btn-sm" data-photo-id="${p.id}" data-decision="keep">&#10003; Keep</button>
                                            <button class="btn-decision btn-reject btn-sm" data-photo-id="${p.id}" data-decision="reject">&#10007; Reject</button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </div>
            `).join("")}
        `;

        // Wire 1-click batch pick & reject
        container.querySelectorAll(".btn-keep-best").forEach(btn => {
            btn.addEventListener("click", async () => {
                const groupId = parseInt(btn.dataset.groupId);
                const pickId = parseInt(btn.dataset.pickId);
                const group = data.groups.find(g => g.group_id === groupId);
                if (!group) return;

                btn.disabled = true;
                btn.textContent = "Applying decisions…";

                for (const p of group.photos) {
                    const dec = (p.id === pickId) ? "keep" : "reject";
                    try {
                        await setDecision(p.id, dec);
                    } catch (_) {}
                }

                btn.textContent = "✓ Applied!";
                setTimeout(() => openBurstGroups(eventId), 600);
            });
        });

        // Wire individual buttons inside burst
        container.querySelectorAll(".btn-decision").forEach(btn => {
            btn.addEventListener("click", async () => {
                const pid = parseInt(btn.dataset.photoId);
                const dec = btn.dataset.decision;
                btn.disabled = true;
                try {
                    await setDecision(pid, dec);
                    openBurstGroups(eventId);
                } catch (e) {
                    alert("Error setting decision: " + e.message);
                }
            });
        });

    } catch (err) {
        container.innerHTML = `<div class="error-msg">&#9888; Failed to calculate burst groups: ${err.message}</div>`;
    }
}

// ---------------------------------------------------------------------------
// Personalization Insights view
// ---------------------------------------------------------------------------
async function loadPersonalizationInsights() {
    try {
        const data = await getPersonalizationInsights();

        document.getElementById("stat-learned-threshold").textContent = data.learned_blur_threshold.toFixed(1);
        const deltaEl = document.getElementById("stat-threshold-delta");
        if (deltaEl) {
            const d = data.blur_adjustment_delta;
            deltaEl.textContent = d === 0
                ? "At default baseline (100.0)"
                : `${d > 0 ? '+' : ''}${d} vs baseline (100.0)`;
        }

        document.getElementById("stat-total-overrides").textContent = data.total_overrides;
        document.getElementById("stat-convergence").textContent = data.personalization_convergence;
        document.getElementById("stat-artistic-style").textContent = data.soft_focus_preference;
        const eyeKeepsEl = document.getElementById("stat-eye-keeps");
        if (eyeKeepsEl) {
            eyeKeepsEl.textContent = `Closed-eye keeps: ${data.emotional_closed_eye_keeps}`;
        }

        const summaryEl = document.getElementById("personalization-summary-text");
        if (summaryEl) summaryEl.textContent = data.summary_insight;

        const tableContainer = document.getElementById("overrides-history-list");
        if (!tableContainer) return;

        if (!data.recent_overrides || data.recent_overrides.length === 0) {
            tableContainer.innerHTML = `<p class="empty-msg">No overrides logged yet. Whenever you choose KEEP on a photo the AI flagged as REVIEW (or vice-versa), the system logs it here and trains your preferences.</p>`;
            return;
        }

        tableContainer.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Photo ID</th>
                        <th>AI Recommendation</th>
                        <th>Photographer Choice</th>
                        <th>Sharpness (Score)</th>
                        <th>Eyes Status</th>
                        <th>Logged At</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.recent_overrides.map(o => `
                        <tr>
                            <td>${o.id}</td>
                            <td>#${o.photo_id}</td>
                            <td><span class="badge ${o.ai_recommendation === 'keep' ? 'badge-green' : 'badge-yellow'}">${o.ai_recommendation.toUpperCase()}</span></td>
                            <td><span class="badge ${o.photographer_decision === 'keep' ? 'badge-blue' : 'badge-red'}">${o.photographer_decision.toUpperCase()}</span></td>
                            <td>${o.blur_score !== null ? o.blur_score : '—'}</td>
                            <td>${o.eyes_status || '—'}</td>
                            <td>${o.created_at}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        showError("overrides-history-list", err.message);
    }
}

// ---------------------------------------------------------------------------
// All Photos Global view
// ---------------------------------------------------------------------------
async function loadAllPhotos() {
    const container = document.getElementById("all-photos-list");
    showLoading("all-photos-list");
    try {
        const events = await getEvents();
        if (events.length === 0) {
            container.innerHTML = `<p class="empty-msg">No events found yet. Create an event and upload photos first.</p>`;
            return;
        }

        let allPhotos = [];
        for (const ev of events) {
            try {
                const photos = await getPhotosWithAnalysis(ev.id);
                photos.forEach(p => p.eventName = ev.name);
                allPhotos.push(...photos);
            } catch (_) {}
        }

        if (allPhotos.length === 0) {
            container.innerHTML = `<p class="empty-msg">No photos uploaded yet across any events.</p>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Preview</th>
                        <th>Filename</th>
                        <th>Event</th>
                        <th>Size</th>
                        <th>AI Recommendation</th>
                        <th>Decision</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${allPhotos.map(p => `
                        <tr>
                            <td>
                                <img src="${photoFileUrl(p.id)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" onerror="this.style.display='none'" />
                            </td>
                            <td><strong>${p.original_filename}</strong></td>
                            <td>${p.eventName}</td>
                            <td>${formatBytes(p.file_size)}</td>
                            <td>
                                ${p.analysis?.ai_recommendation
                                    ? `<span class="badge ${p.analysis.ai_recommendation === 'keep' ? 'badge-green' : 'badge-yellow'}">${p.analysis.ai_recommendation.toUpperCase()}</span>`
                                    : '<span class="badge badge-gray">Not analysed</span>'}
                            </td>
                            <td>
                                ${p.analysis?.photographer_decision
                                    ? `<span class="badge ${p.analysis.photographer_decision === 'keep' ? 'badge-blue' : 'badge-red'}">${p.analysis.photographer_decision.toUpperCase()}</span>`
                                    : '<span class="badge badge-gray">Pending</span>'}
                            </td>
                            <td>
                                <button class="btn-open btn-sm" data-event-id="${p.event_id}">Open Event</button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        container.querySelectorAll(".btn-open").forEach(btn => {
            btn.addEventListener("click", () => openEventDetail(btn.dataset.eventId));
        });

    } catch (err) {
        showError("all-photos-list", err.message);
    }
}

function wireCreateForms() {
    const clientForm = document.getElementById("form-create-client");
    const bookingForm = document.getElementById("form-create-booking");
    const eventForm = document.getElementById("form-create-event");

    if (clientForm) clientForm.addEventListener("submit", handleCreateClient);
    if (bookingForm) bookingForm.addEventListener("submit", handleCreateBooking);
    if (eventForm) eventForm.addEventListener("submit", handleCreateEvent);

    // Live validation for Client Name (strictly reject numbers)
    const clientNameInput = document.getElementById("client-name");
    if (clientNameInput) {
        clientNameInput.addEventListener("input", () => {
            const val = clientNameInput.value;
            if (/\d/.test(val)) {
                setInputError(clientNameInput, "Client name cannot contain numbers. Only letters are allowed.");
            } else if (val && !/^[A-Za-z\s\.\'\-]*$/.test(val)) {
                setInputError(clientNameInput, "Client name can only contain letters, spaces, hyphens, and apostrophes.");
            } else {
                clearInputError(clientNameInput);
            }
        });
        clientNameInput.addEventListener("blur", () => {
            const val = clientNameInput.value.trim();
            if (val) {
                const check = validateClientName(val);
                if (!check.valid) setInputError(clientNameInput, check.error);
            }
        });
    }

    // Live validation for Client Phone (strictly reject letters)
    const clientPhoneInput = document.getElementById("client-phone");
    if (clientPhoneInput) {
        clientPhoneInput.addEventListener("input", () => {
            const val = clientPhoneInput.value;
            if (/[a-zA-Z]/.test(val)) {
                setInputError(clientPhoneInput, "Phone number cannot contain letters. Numbers only (e.g. +94 77 123 4567).");
            } else if (val && !/^\+?[0-9\s\-\(\)]*$/.test(val)) {
                setInputError(clientPhoneInput, "Phone number contains invalid characters. Numbers, +, -, and spaces only.");
            } else {
                clearInputError(clientPhoneInput);
            }
        });
        clientPhoneInput.addEventListener("blur", () => {
            const val = clientPhoneInput.value.trim();
            if (val) {
                const check = validateClientPhone(val);
                if (!check.valid) setInputError(clientPhoneInput, check.error);
            }
        });
    }

    // Live validation for Client Email
    const clientEmailInput = document.getElementById("client-email");
    if (clientEmailInput) {
        clientEmailInput.addEventListener("input", () => {
            const val = clientEmailInput.value;
            if (/\s/.test(val)) {
                setInputError(clientEmailInput, "Email address cannot contain spaces.");
            } else {
                clearInputError(clientEmailInput);
            }
        });
        clientEmailInput.addEventListener("blur", () => {
            const val = clientEmailInput.value.trim();
            if (val) {
                const check = validateClientEmail(val);
                if (!check.valid) setInputError(clientEmailInput, check.error);
            }
        });
    }

    // Generic clear errors for other fields on input
    [clientForm, bookingForm, eventForm].forEach(form => {
        if (!form) return;
        form.querySelectorAll("input, select, textarea").forEach(field => {
            if (field !== clientNameInput && field !== clientPhoneInput && field !== clientEmailInput) {
                field.addEventListener("input", () => clearInputError(field));
                field.addEventListener("change", () => clearInputError(field));
            }
        });
    });

    const bookingDate = document.getElementById("booking-date");
    const eventDate = document.getElementById("event-date");
    const eventTime = document.getElementById("event-time");
    if (bookingDate && !bookingDate.value) bookingDate.value = todayLocalIso();
    if (eventDate && !eventDate.value) eventDate.value = todayLocalIso();
    if (eventTime && !eventTime.value) eventTime.value = "10:00";

    const dashClient = document.getElementById("dash-goto-client");
    const dashBooking = document.getElementById("dash-goto-booking");
    const dashEvent = document.getElementById("dash-goto-event");
    if (dashClient) dashClient.addEventListener("click", () => showSection("section-clients"));
    if (dashBooking) dashBooking.addEventListener("click", () => showSection("section-bookings"));
    if (dashEvent) dashEvent.addEventListener("click", () => showSection("section-events"));
}

async function updateApiStatus() {
    const dot = document.getElementById("api-dot");
    const mobileDot = document.getElementById("mobile-api-dot");
    const text = document.getElementById("api-status-text");
    if (!dot || !text) return;
    try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (res.ok) {
            dot.className = "status-dot online";
            if (mobileDot) mobileDot.className = "status-dot online";
            text.textContent = "API Online";
        } else {
            dot.className = "status-dot offline";
            if (mobileDot) mobileDot.className = "status-dot offline";
            text.textContent = "API Offline";
        }
    } catch (_) {
        dot.className = "status-dot offline";
        if (mobileDot) mobileDot.className = "status-dot offline";
        text.textContent = "API Offline";
    }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
wireCreateForms();
updateApiStatus();
setInterval(updateApiStatus, 15000);
showSection("section-dashboard");
