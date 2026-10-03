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

    // Load data for the newly visible section.
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

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function statusBadge(status) {
    const cls = {
        scheduled:   "badge-blue",
        in_progress: "badge-yellow",
        completed:   "badge-green",
        cancelled:   "badge-red",
        enquiry:     "badge-gray",
        confirmed:   "badge-blue",
    }[status] || "badge-gray";
    return `<span class="badge ${cls}">${status.replace("_", " ")}</span>`;
}

function formatDate(iso) {
    if (!iso) return "—";
    // Handles both "2025-12-14" and full ISO datetime strings.
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="error-msg">⚠ ${message}</div>`;
}

function showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="loading-msg">Loading…</div>`;
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

        // "Upcoming" = events with status scheduled or in_progress.
        const upcoming = events.filter(e =>
            e.status === "scheduled" || e.status === "in_progress"
        );
        document.getElementById("stat-upcoming").textContent = upcoming.length;

        // Recent events list (up to 5, newest date first).
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

            // Clicking a recent event opens the event detail view.
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
        const events = await getEvents();
        if (events.length === 0) {
            container.innerHTML = `<p class="empty-msg">No events found.</p>`;
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
async function openEventDetail(eventId) {
    showSection("section-event-detail");

    const container = document.getElementById("event-detail-content");
    container.innerHTML = `<div class="loading-msg">Loading event…</div>`;

    try {
        const ev = await getEvent(eventId);

        // Try to fetch the parent booking + client for context.
        let booking = null;
        let client  = null;
        try {
            booking = await getBooking(ev.booking_id);
            client  = await getClient(booking.client_id);
        } catch (_) {
            // Non-fatal: show event info even if booking/client fetch fails.
        }

        container.innerHTML = `
            <div class="detail-grid">
                <!-- Event info card -->
                <div class="detail-card">
                    <h3>📸 Event Information</h3>
                    <div class="detail-row"><span>Name</span><strong>${ev.name}</strong></div>
                    <div class="detail-row"><span>Date</span><strong>${formatDate(ev.event_date)}</strong></div>
                    <div class="detail-row"><span>Location</span><strong>${ev.location || "—"}</strong></div>
                    <div class="detail-row"><span>Status</span>${statusBadge(ev.status)}</div>
                    <div class="detail-row"><span>Created</span><strong>${formatDate(ev.created_at)}</strong></div>
                </div>

                <!-- Booking + client context card -->
                <div class="detail-card">
                    <h3>📋 Booking & Client</h3>
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

                <!-- Photos section -->
                <div class="detail-card full-width">
                    <h3>🖼 Photos</h3>
                    <div class="photo-upload-zone">
                        <div class="upload-icon">📂</div>
                        <p><strong>Photo upload coming soon</strong></p>
                        <p class="upload-hint">Drag &amp; drop or click to upload — available in the next milestone.</p>
                        <button class="btn-disabled" disabled>Upload Photos</button>
                    </div>
                </div>

                <!-- AI analysis section -->
                <div class="detail-card full-width">
                    <h3>🤖 AI Analysis</h3>
                    <div class="ai-placeholder">
                        <p><strong>AI photo analysis is not yet available.</strong></p>
                        <p class="upload-hint">
                            Blur detection, face detection, eye-status checking and duplicate
                            grouping will appear here after photos are uploaded.
                        </p>
                        <div class="ai-feature-list">
                            <span class="ai-chip">🔍 Blur Detection</span>
                            <span class="ai-chip">😊 Face Detection</span>
                            <span class="ai-chip">👁 Eye Status</span>
                            <span class="ai-chip">🔀 Duplicate Grouping</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error-msg">⚠ ${err.message}</div>`;
        console.error("[EventDetail]", err);
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
            container.innerHTML = `<p class="empty-msg">No clients found. Add one via the API or Swagger UI.</p>`;
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
        const bookings = await getBookings();
        if (bookings.length === 0) {
            container.innerHTML = `<p class="empty-msg">No bookings found.</p>`;
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
// Bootstrap: show dashboard on first load
// ---------------------------------------------------------------------------
showSection("section-dashboard");
