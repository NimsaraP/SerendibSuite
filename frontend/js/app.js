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
// Navigation & History Stack Management
// ---------------------------------------------------------------------------
const SECTION_TITLES = {
    "section-dashboard": "Dashboard",
    "section-clients": "Clients",
    "section-bookings": "Bookings",
    "section-events": "Events",
    "section-photos": "All Photos",
    "section-ai-insights": "AI Personalization",
    "section-event-detail": "Event Detail",
};

let currentNavigationState = {
    sectionId: "section-dashboard",
    eventId: null,
    title: "Dashboard",
};

const navigationHistory = [];

const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".section");

function updateBackButtons() {
    const topBackBtn = document.getElementById("btn-top-back");
    const topPrevBadge = document.getElementById("btn-top-prev-badge");
    const topDashBtn = document.getElementById("btn-top-dashboard");
    const mobileBackBtn = document.getElementById("btn-mobile-back");
    const backNavDest = document.getElementById("back-nav-dest");
    const eventDetailBackBtn = document.getElementById("btn-back-to-events");

    const hasHistory = navigationHistory.length > 0;
    const isDashboard = currentNavigationState.sectionId === "section-dashboard";

    if (hasHistory) {
        const prev = navigationHistory[navigationHistory.length - 1];
        const destLabel = prev.title || "Previous";

        if (topBackBtn) {
            topBackBtn.style.display = "inline-flex";
            topBackBtn.removeAttribute("disabled");
            topBackBtn.classList.remove("disabled");
            topBackBtn.title = `Back to ${destLabel}`;
        }
        if (topPrevBadge) {
            topPrevBadge.style.display = "inline-flex";
            topPrevBadge.removeAttribute("disabled");
            topPrevBadge.classList.remove("disabled");
            if (backNavDest) backNavDest.textContent = destLabel;
            topPrevBadge.title = `Click to go back to ${destLabel}`;
        }
        if (mobileBackBtn) {
            mobileBackBtn.style.display = "inline-flex";
            mobileBackBtn.removeAttribute("disabled");
            mobileBackBtn.title = `Back to ${destLabel}`;
        }
        if (eventDetailBackBtn) {
            eventDetailBackBtn.textContent = `← Back to ${destLabel}`;
        }
    } else {
        if (isDashboard) {
            if (topBackBtn) {
                topBackBtn.style.display = "inline-flex";
                topBackBtn.setAttribute("disabled", "true");
                topBackBtn.classList.add("disabled");
                topBackBtn.title = "No previous page (You are on Dashboard)";
            }
            if (topPrevBadge) {
                topPrevBadge.style.display = "none";
                topPrevBadge.setAttribute("disabled", "true");
                topPrevBadge.classList.add("disabled");
            }
            if (mobileBackBtn) {
                mobileBackBtn.style.display = "none";
            }
        } else {
            if (topBackBtn) {
                topBackBtn.style.display = "inline-flex";
                topBackBtn.removeAttribute("disabled");
                topBackBtn.classList.remove("disabled");
                topBackBtn.title = "Back to Dashboard";
            }
            if (topPrevBadge) {
                topPrevBadge.style.display = "inline-flex";
                topPrevBadge.removeAttribute("disabled");
                topPrevBadge.classList.remove("disabled");
                if (backNavDest) backNavDest.textContent = "Dashboard";
                topPrevBadge.title = "Click to return to Dashboard";
            }
            if (mobileBackBtn) {
                mobileBackBtn.style.display = "inline-flex";
                mobileBackBtn.removeAttribute("disabled");
                mobileBackBtn.title = "Back to Dashboard";
            }
            if (eventDetailBackBtn) {
                eventDetailBackBtn.textContent = "← Back to Dashboard";
            }
        }
    }

    if (topDashBtn) {
        if (isDashboard) {
            topDashBtn.style.opacity = "0.75";
            topDashBtn.title = "Currently on Dashboard";
        } else {
            topDashBtn.style.opacity = "1";
            topDashBtn.title = "Return to Dashboard";
        }
    }

    const bcCurrent = document.getElementById("bc-current-title");
    if (bcCurrent) {
        bcCurrent.textContent = currentNavigationState.title || "Dashboard";
    }
}

function navigateBack() {
    if (navigationHistory.length === 0) {
        if (currentNavigationState.sectionId !== "section-dashboard") {
            showSection("section-dashboard", { pushHistory: false });
        }
        return;
    }

    const prevState = navigationHistory.pop();
    if (prevState.sectionId === "section-event-detail" && prevState.eventId) {
        openEventDetail(prevState.eventId, false);
    } else {
        showSection(prevState.sectionId, {
            pushHistory: false,
            title: prevState.title,
        });
    }
}

function showSection(sectionId, options = {}) {
    let pushHistory = true;
    let eventId = null;
    let title = null;

    if (typeof options === "boolean") {
        pushHistory = options;
    } else if (typeof options === "object" && options !== null) {
        if (options.pushHistory !== undefined) pushHistory = options.pushHistory;
        if (options.eventId !== undefined) eventId = options.eventId;
        if (options.title !== undefined) title = options.title;
    }

    const isDifferent = currentNavigationState.sectionId !== sectionId ||
        (sectionId === "section-event-detail" && currentNavigationState.eventId !== eventId);

    if (pushHistory && isDifferent) {
        navigationHistory.push({
            sectionId: currentNavigationState.sectionId,
            eventId: currentNavigationState.eventId,
            title: currentNavigationState.title,
        });
        if (navigationHistory.length > 50) {
            navigationHistory.shift();
        }

        try {
            const hash = sectionId.replace("section-", "");
            window.history.pushState(
                { sectionId, eventId, title },
                "",
                hash === "dashboard" ? window.location.pathname : `#${hash}`
            );
        } catch (_) {}
    }

    const resolvedTitle = title || (eventId ? `Event #${eventId}` : SECTION_TITLES[sectionId] || "Workspace");

    currentNavigationState = {
        sectionId,
        eventId,
        title: resolvedTitle,
    };

    sections.forEach(s => s.classList.remove("active"));
    navLinks.forEach(l => l.classList.remove("active"));

    const target = document.getElementById(sectionId);
    if (target) target.classList.add("active");

    const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
    if (activeLink) activeLink.classList.add("active");

    updateBackButtons();

    // Scroll to top when entering a new interface
    scrollToTop(false);

    if (sectionId === "section-dashboard") loadDashboard();
    if (sectionId === "section-events")   loadEvents();
    if (sectionId === "section-clients")  loadClients();
    if (sectionId === "section-bookings") loadBookings();
    if (sectionId === "section-photos")   loadAllPhotos();
    if (sectionId === "section-ai-insights") loadPersonalizationInsights();
}

// ---------------------------------------------------------------------------
// Scroll To Top ("Back to Top")
// ---------------------------------------------------------------------------
function getScrollTop() {
    const mc = document.querySelector(".main-content");
    const mcTop = mc ? mc.scrollTop : 0;
    const winTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    return Math.max(mcTop, winTop);
}

function scrollToTop(smooth = true) {
    const behavior = smooth ? "smooth" : "auto";
    try {
        window.scrollTo({ top: 0, left: 0, behavior });
        document.documentElement.scrollTo({ top: 0, left: 0, behavior });
        document.body.scrollTo({ top: 0, left: 0, behavior });
    } catch (_) {}
    const mc = document.querySelector(".main-content");
    if (mc) {
        try {
            mc.scrollTo({ top: 0, left: 0, behavior });
        } catch (_) {
            mc.scrollTop = 0;
        }
    }
}

function initScrollToTop() {
    const btnScrollTop = document.getElementById("btn-scroll-top");
    if (!btnScrollTop) return;

    function handleScroll() {
        const top = getScrollTop();
        if (top > 120) {
            btnScrollTop.style.display = "flex";
            btnScrollTop.classList.add("visible");
        } else {
            btnScrollTop.style.display = "none";
            btnScrollTop.classList.remove("visible");
        }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true });
    const mc = document.querySelector(".main-content");
    if (mc) {
        mc.addEventListener("scroll", handleScroll, { passive: true });
    }

    btnScrollTop.addEventListener("click", (e) => {
        e.preventDefault();
        scrollToTop(true);
    });

    handleScroll();
}

// Expose globals for direct HTML / inline access
window.navigateBack = navigateBack;
window.scrollToTop = scrollToTop;
window.showSection = showSection;
window.openEventDetail = openEventDetail;

function initBackNavigationListeners() {
    const topBackBtn = document.getElementById("btn-top-back");
    const mobileBackBtn = document.getElementById("btn-mobile-back");
    const eventDetailBackBtn = document.getElementById("btn-back-to-events");

    if (topBackBtn) topBackBtn.addEventListener("click", navigateBack);
    if (mobileBackBtn) mobileBackBtn.addEventListener("click", navigateBack);
    if (eventDetailBackBtn) eventDetailBackBtn.addEventListener("click", navigateBack);

    // Browser back button support in Chrome
    window.addEventListener("popstate", (e) => {
        if (e.state && e.state.sectionId) {
            if (e.state.sectionId === "section-event-detail" && e.state.eventId) {
                openEventDetail(e.state.eventId, false);
            } else {
                showSection(e.state.sectionId, { pushHistory: false, title: e.state.title });
            }
        } else {
            navigateBack();
        }
    });

    // Keyboard shortcut (Alt + Left Arrow)
    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.key === "ArrowLeft") {
            const tag = (document.activeElement && document.activeElement.tagName) || "";
            if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
                e.preventDefault();
                navigateBack();
            }
        }
    });
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

// Global cached dataset for live filters and duplicate checking
let _allClientsData = [];
let _allBookingsData = [];
let _allEventsData = [];

// Track newly added IDs for real-time visual highlight
let _newlyAddedClientId = null;
let _newlyAddedBookingId = null;
let _newlyAddedEventId = null;
let _lastUploadedEventId = null;

function updateDashboardStatsInMemory() {
    const statClients = document.getElementById("stat-clients");
    const statBookings = document.getElementById("stat-bookings");
    const statUpcoming = document.getElementById("stat-upcoming");
    if (statClients) statClients.textContent = _allClientsData.length;
    if (statBookings) statBookings.textContent = _allBookingsData.length;
    if (statUpcoming) {
        const upcoming = _allEventsData.filter(e =>
            e.status === "scheduled" || e.status === "in_progress"
        );
        statUpcoming.textContent = upcoming.length;
    }
}

function getClientName(clientId, fallback = "—") {
    if (!clientId) return fallback;
    const c = _allClientsData.find(item => String(item.id) === String(clientId));
    return c && c.name ? c.name : fallback;
}

function getBookingClientName(bookingId, fallback = "—") {
    if (!bookingId) return fallback;
    const b = _allBookingsData.find(item => String(item.id) === String(bookingId));
    if (!b) return fallback;
    if (b.client_name) return b.client_name;
    return getClientName(b.client_id, fallback);
}

function getBookingTitle(bookingId, fallback = "") {
    if (!bookingId) return fallback;
    const b = _allBookingsData.find(item => String(item.id) === String(bookingId));
    if (!b) return fallback;
    return b.title || fallback;
}

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
        const validEvents = (events || []).filter(ev => {
            const cName = ev.client_name || getBookingClientName(ev.booking_id);
            const bTitle = ev.booking_title || getBookingTitle(ev.booking_id);
            return Boolean(cName && cName !== "—" && cName !== "-" && cName !== "None") &&
                   Boolean(bTitle && bTitle !== "—" && bTitle !== "-" && bTitle !== "None");
        });
        _allClientsData = clients;
        _allBookingsData = bookings;
        _allEventsData = validEvents;

        document.getElementById("stat-clients").textContent  = clients.length;
        document.getElementById("stat-bookings").textContent = bookings.length;

        const upcoming = validEvents.filter(e =>
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
            container.innerHTML = prioritized.map(ev => {
                const clientName = ev.client_name || getBookingClientName(ev.booking_id) || "";
                const bookingTitle = ev.booking_title || getBookingTitle(ev.booking_id) || "";
                return `
                <div class="recent-event-item" data-id="${ev.id}">
                    <div class="rei-header">
                        <div>
                            <div class="rei-name">${escapeHtml(ev.name)}</div>
                            ${clientName ? `
                                <div class="rei-client-sub">
                                    👤 <strong>${escapeHtml(clientName)}</strong>
                                    ${bookingTitle ? `&bull; 📁 ${escapeHtml(bookingTitle)}` : ''}
                                </div>
                            ` : ''}
                        </div>
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
            `;}).join("");

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
// Events list & Live Filters
// ---------------------------------------------------------------------------
let _eventsFilterWired = false;

function parseEventHour(timeStr) {
    if (!timeStr) return -1;
    const s = timeStr.trim();
    const matchAmpm = s.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (matchAmpm) {
        let h = parseInt(matchAmpm[1], 10);
        const ampm = (matchAmpm[3] || "").toUpperCase();
        if (ampm === "PM" && h < 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        return h;
    }
    const match24 = s.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
        return parseInt(match24[1], 10);
    }
    return -1;
}

function renderEventsTable(eventsToRender) {
    const container = document.getElementById("events-list");
    if (!container) return;

    // Filter out events lacking client and booking
    const validEvents = (eventsToRender || []).filter(ev => {
        const cName = ev.client_name || getBookingClientName(ev.booking_id);
        const bTitle = ev.booking_title || getBookingTitle(ev.booking_id);
        return Boolean(cName && cName !== "—" && cName !== "-" && cName !== "None") &&
               Boolean(bTitle && bTitle !== "—" && bTitle !== "-" && bTitle !== "None");
    });

    if (validEvents.length === 0) {
        container.innerHTML = `<p class="empty-msg">No events match the selected filter criteria.</p>`;
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Client &amp; Booking</th>
                    <th>Event Name</th>
                    <th>Date &amp; Time</th>
                    <th>Timing</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${validEvents.map(ev => {
                    const isNew = String(ev.id) === String(_newlyAddedEventId);
                    const isUploaded = String(ev.id) === String(_lastUploadedEventId);
                    const clientName = ev.client_name || getBookingClientName(ev.booking_id) || "—";
                    const bookingTitle = ev.booking_title || getBookingTitle(ev.booking_id) || "";
                    const rowClass = isNew ? 'row-newly-added' : (isUploaded ? 'row-recently-uploaded' : '');
                    return `
                    <tr class="${rowClass}" id="event-row-${ev.id}">
                        <td>${ev.id}</td>
                        <td>
                            <div class="table-client-wrap">
                                <span class="client-badge-pill" title="Client: ${escapeHtml(clientName)}">
                                    👤 <strong>${escapeHtml(clientName)}</strong>
                                </span>
                                ${bookingTitle ? `<div class="table-booking-sub" title="Booking: ${escapeHtml(bookingTitle)}">📁 ${escapeHtml(bookingTitle)}</div>` : ''}
                            </div>
                        </td>
                        <td>
                            <strong>${escapeHtml(ev.name)}</strong>
                            ${isNew ? '<span class="badge-new">JUST ADDED</span>' : ''}
                            ${isUploaded ? '<span class="badge-new badge-uploaded">📸 PHOTOS UPLOADED</span>' : ''}
                        </td>
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
                `;}).join("")}
            </tbody>
        </table>
    `;

    container.querySelectorAll(".btn-open").forEach(btn => {
        btn.addEventListener("click", () => openEventDetail(btn.dataset.id));
    });
}

function applyEventFilter() {
    const dateInput = document.getElementById("filter-event-date");
    const timeInput = document.getElementById("filter-event-time");
    const searchInput = document.getElementById("filter-event-search");
    const countBadge = document.getElementById("event-filter-count");

    const dateVal = dateInput ? dateInput.value : "";
    const timeVal = timeInput ? timeInput.value : "";
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";

    let filtered = _allEventsData;

    if (dateVal) {
        filtered = filtered.filter(ev => {
            const evDate = (ev.event_date || "").slice(0, 10);
            return evDate === dateVal;
        });
    }

    if (timeVal) {
        filtered = filtered.filter(ev => {
            const hour = parseEventHour(ev.event_time);
            if (hour < 0) return false;
            if (timeVal === "morning") return hour < 12;
            if (timeVal === "afternoon") return hour >= 12 && hour < 17;
            if (timeVal === "evening") return hour >= 17;
            return true;
        });
    }

    if (searchVal) {
        filtered = filtered.filter(ev => {
            const clientName = (ev.client_name || getBookingClientName(ev.booking_id) || "").toLowerCase();
            const bookingTitle = (ev.booking_title || getBookingTitle(ev.booking_id) || "").toLowerCase();
            const nameMatch = (ev.name || "").toLowerCase().includes(searchVal);
            const locMatch = (ev.location || "").toLowerCase().includes(searchVal);
            const clientMatch = clientName.includes(searchVal);
            const bookingMatch = bookingTitle.includes(searchVal);
            return nameMatch || locMatch || clientMatch || bookingMatch;
        });
    }

    renderEventsTable(filtered);

    if (countBadge) {
        if (dateVal || timeVal || searchVal) {
            countBadge.textContent = `Showing ${filtered.length} of ${_allEventsData.length}`;
        } else {
            countBadge.textContent = `${_allEventsData.length} total`;
        }
    }
}

function wireEventFilters() {
    if (_eventsFilterWired) return;
    _eventsFilterWired = true;

    const dateInput = document.getElementById("filter-event-date");
    const timeInput = document.getElementById("filter-event-time");
    const searchInput = document.getElementById("filter-event-search");
    const clearBtn = document.getElementById("btn-clear-event-filter");

    if (dateInput) {
        dateInput.addEventListener("change", applyEventFilter);
        dateInput.addEventListener("input", applyEventFilter);
    }
    if (timeInput) {
        timeInput.addEventListener("change", applyEventFilter);
    }
    if (searchInput) {
        searchInput.addEventListener("input", applyEventFilter);
    }
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (dateInput) dateInput.value = "";
            if (timeInput) timeInput.value = "";
            if (searchInput) searchInput.value = "";
            applyEventFilter();
        });
    }
}

async function loadEvents() {
    const container = document.getElementById("events-list");
    showLoading("events-list");
    try {
        await populateEventBookingSelect();
        wireEventFilters();
        if (_allClientsData.length === 0 || _allBookingsData.length === 0) {
            try {
                const [clients, bookings] = await Promise.all([
                    _allClientsData.length === 0 ? getClients() : Promise.resolve(_allClientsData),
                    _allBookingsData.length === 0 ? getBookings() : Promise.resolve(_allBookingsData),
                ]);
                _allClientsData = clients;
                _allBookingsData = bookings;
            } catch (_) {}
        }
        const rawEvents = await getEvents();
        const events = (rawEvents || []).filter(ev => {
            const cName = ev.client_name || getBookingClientName(ev.booking_id);
            const bTitle = ev.booking_title || getBookingTitle(ev.booking_id);
            return Boolean(cName && cName !== "—" && cName !== "-" && cName !== "None") &&
                   Boolean(bTitle && bTitle !== "—" && bTitle !== "-" && bTitle !== "None");
        });

        if (events.length === 0) {
            container.innerHTML = `<p class="empty-msg">No events yet. Use the form above to create one.</p>`;
            return;
        }

        // Sort events so closest upcoming events are placed first
        _allEventsData = [...events].sort((a, b) => {
            const dA = new Date(a.event_date.length === 10 ? a.event_date + "T00:00:00" : a.event_date);
            const dB = new Date(b.event_date.length === 10 ? b.event_date + "T00:00:00" : b.event_date);
            return dA - dB;
        });

        applyEventFilter();
    } catch (err) {
        showError("events-list", err.message);
        console.error("[Events]", err);
    }
}

// ---------------------------------------------------------------------------
// Event detail view
// ---------------------------------------------------------------------------
let _currentEventId = null;
let _currentGalleryPhotos = [];
let _currentLightboxIndex = -1;
let _lightboxZoomed = false;

async function openEventDetail(eventId, pushHistory = true) {
    _currentEventId = eventId;
    showSection("section-event-detail", {
        pushHistory,
        eventId,
        title: `Event #${eventId}`,
    });

    const container = document.getElementById("event-detail-content");
    container.innerHTML = `<div class="loading-msg">Loading event&#8230;</div>`;

    try {
        const ev = await getEvent(eventId);
        if (ev && ev.name) {
            currentNavigationState.title = `Event: ${ev.name}`;
            updateBackButtons();
        }

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
                        <label class="btn-upload-label" for="photo-file-input" style="cursor:pointer;">
                            &#128194; Choose &amp; Upload Photos
                        </label>
                        <input
                            type="file"
                            id="photo-file-input"
                            accept=".jpg,.jpeg,.png"
                            multiple
                            style="display:none"
                        />
                        <span class="upload-file-label" id="upload-file-label">Click to choose photos or drag &amp; drop here (JPG, PNG up to 50MB)</span>
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

        if (fileInput) {
            fileInput.addEventListener("change", () => {
                if (fileInput.files && fileInput.files.length > 0) {
                    if (fileLabel) fileLabel.textContent = `${fileInput.files.length} photo${fileInput.files.length > 1 ? "s" : ""} uploading...`;
                    handleUpload(eventId, fileInput.files);
                }
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener("click", () => {
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    handleUpload(eventId, fileInput.files);
                } else if (fileInput) {
                    fileInput.click();
                }
            });
        }

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
        const btnFinalSelection = document.getElementById("btn-final-selection");
        if (btnFinalSelection) {
            btnFinalSelection.addEventListener("click", () => {
                openFinalSelection(eventId);
            });
        }

        const btnBackGallery = document.getElementById("btn-back-gallery");
        if (btnBackGallery) {
            btnBackGallery.addEventListener("click", () => {
                const fs = document.getElementById("final-selection-panel");
                const bg = document.getElementById("burst-groups-panel");
                const ps = document.getElementById("photos-section");
                if (fs) fs.style.display = "none";
                if (bg) bg.style.display = "none";
                if (ps) ps.style.display = "";
            });
        }

        // Duplicate bursts toggle
        const btnViewBursts = document.getElementById("btn-view-bursts");
        if (btnViewBursts) {
            btnViewBursts.addEventListener("click", () => {
                openBurstGroups(eventId);
            });
        }

        const btnBackFromBursts = document.getElementById("btn-back-from-bursts");
        if (btnBackFromBursts) {
            btnBackFromBursts.addEventListener("click", () => {
                const bg = document.getElementById("burst-groups-panel");
                const ps = document.getElementById("photos-section");
                if (bg) bg.style.display = "none";
                if (ps) ps.style.display = "";
            });
        }

        // XMP Export buttons
        const handleXmpExport = () => {
            window.location.href = xmpExportUrl(eventId);
        };
        const btnExportXmp = document.getElementById("btn-export-xmp");
        if (btnExportXmp) btnExportXmp.addEventListener("click", handleXmpExport);

        const btnExportXmpFinal = document.getElementById("btn-export-xmp-final");
        if (btnExportXmpFinal) btnExportXmpFinal.addEventListener("click", handleXmpExport);

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
        _currentGalleryPhotos = photos || [];

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
        // All analysed — provide 1-click Re-analyse All Photos button
        bar.innerHTML = `
            <div class="batch-action-done" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="batch-done-icon">&#10003;</span>
                    <span><strong>All ${total} photos analysed</strong></span>
                </div>
                <button class="btn-analyse-all btn-reanalyse-all" id="btn-reanalyse-all" data-event-id="${eventId}">
                    &#8635; Re-analyse All (${total}) Photos
                </button>
            </div>
        `;
        const reBtn = document.getElementById("btn-reanalyse-all");
        if (reBtn) {
            reBtn.addEventListener("click", () => {
                analyseAll(eventId, photos.map(p => p.id));
            });
        }
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
        <div class="batch-action-ready" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div class="batch-action-status">${statusText}</div>
            <div style="display:flex;gap:8px;align-items:center;">
                <button class="btn-analyse-all" id="btn-analyse-all" data-event-id="${eventId}">
                    ${btnLabel}
                </button>
                ${isPartial ? `
                    <button class="btn-secondary-action" id="btn-reanalyse-everything" data-event-id="${eventId}" title="Re-run AI on every photo">
                        &#8635; Re-analyse All (${total})
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    const btnAnalyseAll = document.getElementById("btn-analyse-all");
    if (btnAnalyseAll) {
        btnAnalyseAll.addEventListener("click", () => {
            analyseAll(eventId, unanalysed.map(p => p.id));
        });
    }

    const reAllBtn = document.getElementById("btn-reanalyse-everything");
    if (reAllBtn) {
        reAllBtn.addEventListener("click", () => {
            analyseAll(eventId, photos.map(p => p.id));
        });
    }
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

    // Update in-memory photos cache
    const p = _currentGalleryPhotos.find(item => item.id === photoId);
    if (p) {
        p.analysis = {
            ...(p.analysis || {}),
            ai_recommendation:     result.ai_recommendation,
            is_blurry:             result.is_blurry,
            blur_score:            result.blur_score,
            face_detected:         result.face_detected,
            eyes_status:           result.eyes_status,
            photographer_decision: result.photographer_decision,
        };
    }

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
    const thumbWrap = card.querySelector(".photo-thumb-wrap");
    if (thumbWrap) {
        thumbWrap.onclick = () => openPhotoLightbox(photoId);
    }
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

    const decisionHtml = renderDecisionSection(photo.id, a?.photographer_decision);

    const aiSection = a
        ? renderAnalysisZone(photo.id, a)
        : `<div class="photo-ai-zone" id="ai-zone-${photo.id}">
               <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                   <span class="ai-status-chip chip-pending">Not analysed</span>
                   <button class="btn-analyse" data-photo-id="${photo.id}">&#129302; Analyse</button>
               </div>
               ${decisionHtml}
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
    gallery.querySelectorAll(".photo-card").forEach(card => {
        const thumbWrap = card.querySelector(".photo-thumb-wrap");
        if (thumbWrap) {
            thumbWrap.addEventListener("click", () => {
                const photoId = parseInt(card.dataset.photoId);
                openPhotoLightbox(photoId);
            });
        }
    });

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
                <div class="final-thumb-card" data-photo-id="${p.id}">
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

        grid.querySelectorAll(".final-thumb-card").forEach(card => {
            const thumbWrap = card.querySelector(".photo-thumb-wrap");
            if (thumbWrap) {
                thumbWrap.addEventListener("click", () => {
                    const pid = parseInt(card.dataset.photoId);
                    openPhotoLightbox(pid, kept);
                });
            }
        });

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
        _lastUploadedEventId = eventId;
        await loadPhotoGallery(eventId);
        setTimeout(() => {
            if (progressArea) progressArea.innerHTML = "";
        }, 2500);
    }
}

// ---------------------------------------------------------------------------
// Clients list & Live Filters
// ---------------------------------------------------------------------------
let _clientsFilterWired = false;

function renderClientsTable(clientsToRender) {
    const container = document.getElementById("clients-list");
    if (!container) return;
    if (clientsToRender.length === 0) {
        container.innerHTML = `<p class="empty-msg">No clients match the selected filter criteria.</p>`;
        return;
    }
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Added Date</th><th>Action</th></tr>
            </thead>
            <tbody>
                ${clientsToRender.map(c => {
                    const isNew = String(c.id) === String(_newlyAddedClientId);
                    return `
                    <tr class="${isNew ? 'row-newly-added' : ''}" id="client-row-${c.id}">
                        <td>${c.id}</td>
                        <td>
                            <strong>${escapeHtml(c.name)}</strong>
                            ${isNew ? '<span class="badge-new">JUST ADDED</span>' : ''}
                        </td>
                        <td>${escapeHtml(c.email)}</td>
                        <td>${escapeHtml(c.phone || "—")}</td>
                        <td>${formatDate(c.created_at)}</td>
                        <td>
                            <button class="btn-open btn-client-add-booking" data-client-id="${c.id}" title="Create a booking for this client">
                                + Add Booking
                            </button>
                        </td>
                    </tr>
                `;}).join("")}
            </tbody>
        </table>
    `;

    container.querySelectorAll(".btn-client-add-booking").forEach(btn => {
        btn.addEventListener("click", () => {
            const cId = btn.dataset.clientId;
            pendingBookingClientId = cId;
            showSection("section-bookings");
            const select = document.getElementById("booking-client");
            if (select) {
                select.value = cId;
                select.focus();
            }
        });
    });
}

function applyClientFilter() {
    const dateInput = document.getElementById("filter-client-date");
    const searchInput = document.getElementById("filter-client-search");
    const countBadge = document.getElementById("client-filter-count");

    const dateVal = dateInput ? dateInput.value : "";
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";

    let filtered = _allClientsData;

    if (dateVal) {
        filtered = filtered.filter(c => {
            if (!c.created_at) return false;
            const cDate = String(c.created_at).slice(0, 10);
            return cDate === dateVal;
        });
    }

    if (searchVal) {
        filtered = filtered.filter(c => {
            const nameMatch = (c.name || "").toLowerCase().includes(searchVal);
            const emailMatch = (c.email || "").toLowerCase().includes(searchVal);
            const phoneMatch = (c.phone || "").toLowerCase().includes(searchVal);
            return nameMatch || emailMatch || phoneMatch;
        });
    }

    renderClientsTable(filtered);

    if (countBadge) {
        if (dateVal || searchVal) {
            countBadge.textContent = `Showing ${filtered.length} of ${_allClientsData.length}`;
        } else {
            countBadge.textContent = `${_allClientsData.length} total`;
        }
    }
}

function wireClientFilters() {
    if (_clientsFilterWired) return;
    _clientsFilterWired = true;

    const dateInput = document.getElementById("filter-client-date");
    const searchInput = document.getElementById("filter-client-search");
    const clearBtn = document.getElementById("btn-clear-client-filter");

    if (dateInput) {
        dateInput.addEventListener("change", applyClientFilter);
        dateInput.addEventListener("input", applyClientFilter);
    }
    if (searchInput) {
        searchInput.addEventListener("input", applyClientFilter);
    }
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (dateInput) dateInput.value = "";
            if (searchInput) searchInput.value = "";
            applyClientFilter();
        });
    }
}

async function loadClients() {
    const container = document.getElementById("clients-list");
    showLoading("clients-list");
    try {
        wireClientFilters();
        const clients = await getClients();
        if (clients.length === 0) {
            container.innerHTML = `<p class="empty-msg">No clients yet. Use the form above to create one.</p>`;
            return;
        }
        _allClientsData = clients;
        applyClientFilter();
    } catch (err) {
        showError("clients-list", err.message);
        console.error("[Clients]", err);
    }
}

// ---------------------------------------------------------------------------
// Bookings list & Live Filters
// ---------------------------------------------------------------------------
let _bookingsFilterWired = false;

function renderBookingsTable(bookingsToRender) {
    const container = document.getElementById("bookings-list");
    if (!container) return;
    if (bookingsToRender.length === 0) {
        container.innerHTML = `<p class="empty-msg">No bookings match the selected filter criteria.</p>`;
        return;
    }
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>#</th><th>Client</th><th>Title</th><th>Booking Date</th><th>Status</th><th>Notes</th><th>Action</th></tr>
            </thead>
            <tbody>
                ${bookingsToRender.map(b => {
                    const isNew = String(b.id) === String(_newlyAddedBookingId);
                    const clientName = b.client_name || getClientName(b.client_id) || "—";
                    return `
                    <tr class="${isNew ? 'row-newly-added' : ''}" id="booking-row-${b.id}">
                        <td>${b.id}</td>
                        <td>
                            <span class="client-badge-pill" title="Client: ${escapeHtml(clientName)}">
                                👤 <strong>${escapeHtml(clientName)}</strong>
                            </span>
                        </td>
                        <td>
                            <strong>${escapeHtml(b.title)}</strong>
                            ${isNew ? '<span class="badge-new">JUST ADDED</span>' : ''}
                        </td>
                        <td>${formatDate(b.booking_date)}</td>
                        <td>${statusBadge(b.status)}</td>
                        <td>${escapeHtml(b.notes || "—")}</td>
                        <td>
                            <button class="btn-open btn-booking-add-event" data-booking-id="${b.id}" title="Create an event for this booking">
                                + Add Event
                            </button>
                        </td>
                    </tr>
                `;}).join("")}
            </tbody>
        </table>
    `;

    container.querySelectorAll(".btn-booking-add-event").forEach(btn => {
        btn.addEventListener("click", () => {
            const bId = btn.dataset.bookingId;
            pendingEventBookingId = bId;
            showSection("section-events");
            const select = document.getElementById("event-booking");
            if (select) {
                select.value = bId;
                select.focus();
            }
        });
    });
}

function applyBookingFilter() {
    const dateInput = document.getElementById("filter-booking-date");
    const statusInput = document.getElementById("filter-booking-status");
    const searchInput = document.getElementById("filter-booking-search");
    const countBadge = document.getElementById("booking-filter-count");

    const dateVal = dateInput ? dateInput.value : "";
    const statusVal = statusInput ? statusInput.value : "";
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";

    let filtered = _allBookingsData;

    if (dateVal) {
        filtered = filtered.filter(b => {
            const bDate = (b.booking_date || "").slice(0, 10);
            return bDate === dateVal;
        });
    }

    if (statusVal) {
        filtered = filtered.filter(b => b.status === statusVal);
    }

    if (searchVal) {
        filtered = filtered.filter(b => {
            const clientName = (b.client_name || getClientName(b.client_id) || "").toLowerCase();
            const titleMatch = (b.title || "").toLowerCase().includes(searchVal);
            const notesMatch = (b.notes || "").toLowerCase().includes(searchVal);
            const clientMatch = clientName.includes(searchVal);
            return titleMatch || notesMatch || clientMatch;
        });
    }

    renderBookingsTable(filtered);

    if (countBadge) {
        if (dateVal || statusVal || searchVal) {
            countBadge.textContent = `Showing ${filtered.length} of ${_allBookingsData.length}`;
        } else {
            countBadge.textContent = `${_allBookingsData.length} total`;
        }
    }
}

function wireBookingFilters() {
    if (_bookingsFilterWired) return;
    _bookingsFilterWired = true;

    const dateInput = document.getElementById("filter-booking-date");
    const statusInput = document.getElementById("filter-booking-status");
    const searchInput = document.getElementById("filter-booking-search");
    const clearBtn = document.getElementById("btn-clear-booking-filter");

    if (dateInput) {
        dateInput.addEventListener("change", applyBookingFilter);
        dateInput.addEventListener("input", applyBookingFilter);
    }
    if (statusInput) {
        statusInput.addEventListener("change", applyBookingFilter);
    }
    if (searchInput) {
        searchInput.addEventListener("input", applyBookingFilter);
    }
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (dateInput) dateInput.value = "";
            if (statusInput) statusInput.value = "";
            if (searchInput) searchInput.value = "";
            applyBookingFilter();
        });
    }
}

async function loadBookings() {
    const container = document.getElementById("bookings-list");
    showLoading("bookings-list");
    try {
        await populateBookingClientSelect();
        wireBookingFilters();
        if (_allClientsData.length === 0) {
            try { _allClientsData = await getClients(); } catch (_) {}
        }
        const bookings = await getBookings();
        if (bookings.length === 0) {
            container.innerHTML = `<p class="empty-msg">No bookings yet. Use the form above to create one.</p>`;
            return;
        }
        _allBookingsData = bookings;
        applyBookingFilter();
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

function updateChipState(input) {
    if (!input) return;
    const parent = input.closest(".input-with-presets");
    if (!parent) return;
    const chips = parent.querySelectorAll(".btn-chip");
    chips.forEach(chip => chip.classList.remove("active"));

    if (input.type === "date") {
        const val = input.value;
        if (!val) return;
        chips.forEach(chip => {
            const daysAttr = chip.dataset.days;
            if (daysAttr !== undefined && daysAttr !== null) {
                const days = parseInt(daysAttr, 10);
                const d = new Date();
                d.setDate(d.getDate() + days);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                if (`${y}-${m}-${day}` === val) {
                    chip.classList.add("active");
                }
            }
        });
    } else if (input.type === "time") {
        const val = (input.value || "").trim();
        if (!val) return;
        chips.forEach(chip => {
            if (chip.dataset.val === val) {
                chip.classList.add("active");
            }
        });
    } else if (input.tagName === "SELECT") {
        const val = (input.value || "").trim();
        if (!val) return;
        chips.forEach(chip => {
            if (chip.dataset.val === val) {
                chip.classList.add("active");
            }
        });
    }
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
    clearInputWarning(inputEl);
    inputEl.classList.add("input-error");
    const container = inputEl.closest("label") || inputEl.parentElement;
    let errEl = container.querySelector(".field-error-msg");
    if (!errEl) {
        errEl = document.createElement("span");
        errEl.className = "field-error-msg";
        container.appendChild(errEl);
    }
    errEl.textContent = message;
}

function clearInputError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove("input-error");
    const container = inputEl.closest("label") || inputEl.parentElement;
    const errEl = container.querySelector(".field-error-msg");
    if (errEl) errEl.remove();
}

function setInputWarning(inputEl, message) {
    if (!inputEl) return;
    clearInputError(inputEl);
    inputEl.classList.add("input-warning");
    const container = inputEl.closest("label") || inputEl.parentElement;
    let warnEl = container.querySelector(".field-warning-msg");
    if (!warnEl) {
        warnEl = document.createElement("span");
        warnEl.className = "field-warning-msg";
        container.appendChild(warnEl);
    }
    warnEl.textContent = `⚠️ Warning: ${message}`;
}

function clearInputWarning(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove("input-warning");
    const container = inputEl.closest("label") || inputEl.parentElement;
    const warnEl = container.querySelector(".field-warning-msg");
    if (warnEl) warnEl.remove();
}

function clearAllFormErrors(form) {
    form.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    form.querySelectorAll(".input-warning").forEach(el => el.classList.remove("input-warning"));
    form.querySelectorAll(".field-error-msg").forEach(el => el.remove());
    form.querySelectorAll(".field-warning-msg").forEach(el => el.remove());
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
    let icon = "&#10003;";
    if (type === "error") icon = "&#9888;";
    if (type === "warning") icon = "&#9888;";
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400);
    }, 4500);
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

function showFormWarning(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!message) {
        el.hidden = true;
        el.textContent = "";
        return;
    }
    el.hidden = false;
    el.innerHTML = `<strong>⚠️ Warning:</strong> ${escapeHtml(message)}`;
}

function normalizeDigits(str) {
    return (str || "").replace(/\D/g, "");
}

function findDuplicateClientName(name, excludeId = null) {
    const clean = (name || "").trim().toLowerCase();
    if (!clean) return null;
    return _allClientsData.find(c => (!excludeId || c.id !== excludeId) && (c.name || "").trim().toLowerCase() === clean);
}

function findDuplicateClientEmail(email, excludeId = null) {
    const clean = (email || "").trim().toLowerCase();
    if (!clean) return null;
    return _allClientsData.find(c => (!excludeId || c.id !== excludeId) && (c.email || "").trim().toLowerCase() === clean);
}

function findDuplicateClientPhone(phone, excludeId = null) {
    const digits = normalizeDigits(phone);
    if (!digits) return null;
    return _allClientsData.find(c => {
        if (excludeId && c.id === excludeId) return false;
        const cDigits = normalizeDigits(c.phone);
        if (!cDigits) return false;
        if (cDigits === digits) return true;
        if (cDigits.length >= 9 && digits.length >= 9 && cDigits.slice(-9) === digits.slice(-9)) return true;
        return false;
    });
}

function findDuplicateBooking(clientId, title, excludeId = null) {
    const cId = Number(clientId);
    const cleanTitle = (title || "").trim().toLowerCase();
    if (!cId || !cleanTitle) return null;
    return _allBookingsData.find(b => {
        if (excludeId && b.id === excludeId) return false;
        return Number(b.client_id) === cId && (b.title || "").trim().toLowerCase() === cleanTitle;
    });
}

function findDuplicateEventName(bookingId, name, excludeId = null) {
    const bId = Number(bookingId);
    const cleanName = (name || "").trim().toLowerCase();
    if (!bId || !cleanName) return null;
    return _allEventsData.find(e => {
        if (excludeId && e.id === excludeId) return false;
        return Number(e.booking_id) === bId && (e.name || "").trim().toLowerCase() === cleanName;
    });
}

function findDuplicateEventSlot(bookingId, date, time, excludeId = null) {
    const bId = Number(bookingId);
    const cleanDate = (date || "").slice(0, 10);
    const cleanTime = (time || "").trim();
    if (!bId || !cleanDate || !cleanTime) return null;
    return _allEventsData.find(e => {
        if (excludeId && e.id === excludeId) return false;
        if (Number(e.booking_id) !== bId) return false;
        const eDate = (e.event_date || "").slice(0, 10);
        const eTime = (e.event_time || "").trim();
        return eDate === cleanDate && eTime === cleanTime;
    });
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
    showFormWarning("client-form-warning", "");
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

    // Duplicate checks for client name/username, email, phone
    const dupName = findDuplicateClientName(nameVal);
    if (dupName) {
        setInputWarning(nameInput, `A client with name "${nameVal}" already exists.`);
        showFormWarning("client-form-warning", `Cannot create client: The name/username "${nameVal}" is already registered. Please choose a unique name.`);
        showToast(`Warning: Client name "${nameVal}" already exists!`, "warning");
        nameInput.focus();
        return;
    }

    const dupEmail = findDuplicateClientEmail(emailVal);
    if (dupEmail) {
        setInputWarning(emailInput, `This email is already registered to client "${dupEmail.name}".`);
        showFormWarning("client-form-warning", `Cannot create client: The email "${emailVal}" is already registered to client "${dupEmail.name}". Duplicate emails are not allowed.`);
        showToast("Warning: This email address is already registered!", "warning");
        emailInput.focus();
        return;
    }

    if (phoneVal) {
        const dupPhone = findDuplicateClientPhone(phoneVal);
        if (dupPhone) {
            setInputWarning(phoneInput, `This phone number is already registered to client "${dupPhone.name}".`);
            showFormWarning("client-form-warning", `Cannot create client: The phone number "${phoneVal}" is already registered to client "${dupPhone.name}". Duplicate phone numbers are not allowed.`);
            showToast("Warning: This phone number is already registered!", "warning");
            phoneInput.focus();
            return;
        }
    }

    setFormBusy(form, true);

    try {
        const created = await createClient({
            name: nameVal,
            email: emailVal,
            phone: optionalText(phoneVal),
            notes: optionalText(notesVal),
        });
        _allClientsData.unshift(created);
        _newlyAddedClientId = created.id;
        pendingBookingClientId = created.id;
        form.reset();
        clearAllFormErrors(form);
        showFormWarning("client-form-warning", "");

        // Clear filter inputs so the newly added client is immediately visible
        const dateInput = document.getElementById("filter-client-date");
        const searchInput = document.getElementById("filter-client-search");
        if (dateInput) dateInput.value = "";
        if (searchInput) searchInput.value = "";
        applyClientFilter();

        updateDashboardStatsInMemory();

        // Smoothly scroll to the newly created row in real time
        setTimeout(() => {
            const newRow = document.getElementById(`client-row-${created.id}`);
            if (newRow) {
                newRow.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 80);

        // Remove glowing indicator after 6 seconds
        setTimeout(() => {
            if (_newlyAddedClientId === created.id) {
                _newlyAddedClientId = null;
            }
        }, 6000);

        // Pre-populate booking dropdown in background
        populateBookingClientSelect().catch(() => {});

        showToast(`Client "${created.name}" created successfully! Added to table below.`);
    } catch (err) {
        const msg = err.message || "Failed to create client";
        showFormError("client-form-error", msg);
        showToast(msg, "error");
        console.error("[CreateClient]", err);
        const lower = msg.toLowerCase();
        if (lower.includes("name") || lower.includes("username")) {
            setInputWarning(nameInput, msg);
            nameInput.focus();
        } else if (lower.includes("email")) {
            setInputWarning(emailInput, msg);
            emailInput.focus();
        } else if (lower.includes("phone")) {
            setInputWarning(phoneInput, msg);
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
    showFormWarning("booking-form-warning", "");
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

    // Duplicate check: One client can have multiple bookings, but duplicate booking titles are not allowed.
    const dupBooking = findDuplicateBooking(clientId, titleVal);
    if (dupBooking) {
        setInputWarning(titleInput, `A booking titled "${titleVal}" already exists for this client (Booking #${dupBooking.id}).`);
        showFormWarning("booking-form-warning", `Cannot create booking: A booking titled "${titleVal}" already exists for this client. Duplicate bookings are not allowed.`);
        showToast("Warning: A booking with this title already exists for this client!", "warning");
        titleInput.focus();
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
        created.client_name = created.client_name || getClientName(created.client_id);
        _allBookingsData.unshift(created);
        _newlyAddedBookingId = created.id;
        pendingEventBookingId = created.id;
        pendingBookingClientId = null;
        form.reset();
        clearAllFormErrors(form);
        showFormWarning("booking-form-warning", "");
        const bookingDateEl = document.getElementById("booking-date");
        if (bookingDateEl) {
            bookingDateEl.value = todayLocalIso();
            updateChipState(bookingDateEl);
        }
        document.getElementById("booking-status").value = "confirmed";

        // Reset filter inputs so newly created booking is immediately visible at top
        const filterDate = document.getElementById("filter-booking-date");
        const filterStatus = document.getElementById("filter-booking-status");
        const filterSearch = document.getElementById("filter-booking-search");
        if (filterDate) filterDate.value = "";
        if (filterStatus) filterStatus.value = "";
        if (filterSearch) filterSearch.value = "";
        applyBookingFilter();

        updateDashboardStatsInMemory();

        // Smoothly scroll to the newly created booking row in real time
        setTimeout(() => {
            const newRow = document.getElementById(`booking-row-${created.id}`);
            if (newRow) {
                newRow.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 80);

        // Remove glowing indicator after 6 seconds
        setTimeout(() => {
            if (_newlyAddedBookingId === created.id) {
                _newlyAddedBookingId = null;
            }
        }, 6000);

        // Pre-populate event booking dropdown in background
        populateEventBookingSelect().catch(() => {});

        showToast(`Booking "${created.title}" created successfully! Added to table below.`);
    } catch (err) {
        const msg = err.message || "Failed to create booking";
        showFormError("booking-form-error", msg);
        showToast(msg, "error");
        console.error("[CreateBooking]", err);
        const lower = msg.toLowerCase();
        if (lower.includes("title") || lower.includes("duplicate")) {
            setInputWarning(titleInput, msg);
            titleInput.focus();
        }
    } finally {
        setFormBusy(form, false);
    }
}

async function handleCreateEvent(e) {
    e.preventDefault();
    const form = e.currentTarget;
    showFormError("event-form-error", "");
    showFormWarning("event-form-warning", "");
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

    // Validate that Event Date is NOT earlier than the selected Booking's Date
    const chosenBooking = _allBookingsData.find(b => String(b.id) === String(bookingId));
    if (chosenBooking && chosenBooking.booking_date && dateVal) {
        const bDateStr = String(chosenBooking.booking_date).slice(0, 10);
        if (dateVal < bDateStr) {
            setInputError(dateInput, `Event date (${formatDate(dateVal)}) cannot be earlier than booking date (${formatDate(bDateStr)}).`);
            showFormWarning("event-form-warning", `Cannot create event: The event date (${formatDate(dateVal)}) cannot be earlier than the booking date (${formatDate(bDateStr)}) for booking "${chosenBooking.title}".`);
            showToast(`Error: Event date cannot be earlier than booking date (${formatDate(bDateStr)})!`, "error");
            hasError = true;
            if (!firstErrorEl) firstErrorEl = dateInput;
        }
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

    // Duplicate check: One booking can have multiple events, but duplicate event names and identical time slots are rejected.
    const dupEventName = findDuplicateEventName(bookingId, nameVal);
    if (dupEventName) {
        setInputWarning(nameInput, `An event named "${nameVal}" already exists for this booking (Event #${dupEventName.id}).`);
        showFormWarning("event-form-warning", `Cannot create event: An event named "${nameVal}" already exists for this booking. Duplicate events are not allowed.`);
        showToast("Warning: An event with this name already exists for this booking!", "warning");
        nameInput.focus();
        return;
    }

    if (timeVal) {
        const dupSlot = findDuplicateEventSlot(bookingId, dateVal, timeVal);
        if (dupSlot) {
            setInputWarning(timeInput, `An event ("${dupSlot.name}") is already scheduled at ${timeVal} on ${dateVal} for this booking.`);
            showFormWarning("event-form-warning", `Cannot create event: An event ("${dupSlot.name}") is already scheduled at ${timeVal} on ${dateVal} for this booking. Duplicate time slots are not allowed.`);
            showToast("Warning: An event is already scheduled at this date & time for this booking!", "warning");
            timeInput.focus();
            return;
        }
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
        created.client_name = created.client_name || getBookingClientName(created.booking_id);
        created.booking_title = created.booking_title || getBookingTitle(created.booking_id);
        _allEventsData.unshift(created);
        _newlyAddedEventId = created.id;
        pendingEventBookingId = null;
        form.reset();
        clearAllFormErrors(form);
        showFormWarning("event-form-warning", "");
        const eventDateEl = document.getElementById("event-date");
        if (eventDateEl) {
            eventDateEl.value = todayLocalIso();
            updateChipState(eventDateEl);
        }
        if (timeInput) {
            timeInput.value = "10:00";
            updateChipState(timeInput);
        }
        document.getElementById("event-status").value = "scheduled";

        // Reset filter inputs so newly created event is immediately visible at top
        const filterDate = document.getElementById("filter-event-date");
        const filterTime = document.getElementById("filter-event-time");
        const filterSearch = document.getElementById("filter-event-search");
        if (filterDate) filterDate.value = "";
        if (filterTime) filterTime.value = "";
        if (filterSearch) filterSearch.value = "";
        applyEventFilter();

        updateDashboardStatsInMemory();

        // Smoothly scroll to the newly created event row in real time
        setTimeout(() => {
            const newRow = document.getElementById(`event-row-${created.id}`);
            if (newRow) {
                newRow.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 80);

        // Remove glowing indicator after 6 seconds
        setTimeout(() => {
            if (_newlyAddedEventId === created.id) {
                _newlyAddedEventId = null;
            }
        }, 6000);

        showToast(`Event "${created.name}" created successfully! Added to events list below.`);
    } catch (err) {
        const msg = err.message || "Failed to create event";
        showFormError("event-form-error", msg);
        showToast(msg, "error");
        console.error("[CreateEvent]", err);
        const lower = msg.toLowerCase();
        if (lower.includes("name") || lower.includes("duplicate")) {
            setInputWarning(nameInput, msg);
            nameInput.focus();
        } else if (lower.includes("time") || lower.includes("slot") || lower.includes("scheduled")) {
            if (timeInput) {
                setInputWarning(timeInput, msg);
                timeInput.focus();
            }
        }
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
                                <div class="${cardStyle}" id="burst-card-${p.id}" data-photo-id="${p.id}">
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

        // Helper to update burst card UI in-place without jarring reload
        const updateBurstCardUi = (photoId, decision) => {
            const card = document.getElementById(`burst-card-${photoId}`);
            if (!card) return;
            const thumbWrap = card.querySelector(".photo-thumb-wrap");
            if (thumbWrap) {
                thumbWrap.querySelectorAll(".card-decision-banner").forEach(el => el.remove());
                if (decision === "keep") {
                    const b = document.createElement("div");
                    b.className = "card-decision-banner banner-keep";
                    b.innerHTML = "&#10003; Selected";
                    thumbWrap.appendChild(b);
                } else if (decision === "reject") {
                    const b = document.createElement("div");
                    b.className = "card-decision-banner banner-reject";
                    b.innerHTML = "&#10007; Rejected";
                    thumbWrap.appendChild(b);
                }
            }
            card.querySelectorAll(".btn-decision").forEach(b => {
                b.disabled = false;
                if (b.dataset.decision === decision) {
                    b.style.opacity = "1";
                    b.style.fontWeight = "700";
                    b.style.boxShadow = "0 0 0 2px #ffffff";
                } else {
                    b.style.opacity = "0.6";
                    b.style.fontWeight = "normal";
                    b.style.boxShadow = "none";
                }
            });
        };

        // Wire 1-click batch pick & reject
        container.querySelectorAll(".btn-keep-best").forEach(btn => {
            btn.addEventListener("click", async () => {
                const groupId = parseInt(btn.dataset.groupId);
                const pickId = parseInt(btn.dataset.pickId);
                const group = data.groups.find(g => g.group_id === groupId);
                if (!group) return;

                btn.disabled = true;
                const origText = btn.innerHTML;
                btn.innerHTML = `<span class="spinner-inline"></span> Applying decisions…`;

                // Update UI in-place immediately
                for (const p of group.photos) {
                    const dec = (p.id === pickId) ? "keep" : "reject";
                    updateBurstCardUi(p.id, dec);
                }

                try {
                    await Promise.all(group.photos.map(p => {
                        const dec = (p.id === pickId) ? "keep" : "reject";
                        return setDecision(p.id, dec).catch(err => console.warn(err));
                    }));
                    btn.innerHTML = "&#10003; Top Pick Kept, Others Rejected!";
                    btn.style.background = "#10b981";
                    btn.style.borderColor = "#10b981";
                    showToast("AI Top Pick selected and duplicate frames marked as rejected!");
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.innerHTML = origText;
                        btn.style.background = "";
                        btn.style.borderColor = "";
                    }, 2500);
                } catch (e) {
                    btn.disabled = false;
                    btn.innerHTML = origText;
                    showToast("Error saving burst decisions: " + e.message, "error");
                }
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
                    updateBurstCardUi(pid, dec);
                    showToast(`Photo #${pid} marked as ${dec === "keep" ? "Keep" : "Reject"}`);
                } catch (e) {
                    btn.disabled = false;
                    showToast("Error setting decision: " + e.message, "error");
                }
            });
        });

        // Wire thumbnail clicks in burst view to open fullscreen lightbox
        const allBurstPhotos = data.groups.flatMap(g => g.photos);
        container.querySelectorAll(".burst-photo-item").forEach(card => {
            const thumbWrap = card.querySelector(".photo-thumb-wrap");
            if (thumbWrap) {
                thumbWrap.addEventListener("click", () => {
                    const pid = parseInt(card.dataset.photoId || card.id.replace("burst-card-", ""));
                    openPhotoLightbox(pid, allBurstPhotos);
                });
            }
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
        const [events, allPhotos] = await Promise.all([
            getEvents().catch(() => []),
            getPhotosWithAnalysis().catch(() => []),
        ]);

        if (allPhotos.length === 0) {
            container.innerHTML = `<p class="empty-msg">No photos uploaded yet across any events. Select an event and upload photos first.</p>`;
            return;
        }

        const eventMap = {};
        events.forEach(ev => { eventMap[ev.id] = ev.name; });
        allPhotos.forEach(p => {
            p.eventName = eventMap[p.event_id] || `Event #${p.event_id}`;
        });

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
                                <img src="${photoFileUrl(p.id)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;background:#1e293b;" alt="${escapeHtml(p.original_filename)}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 24 24\' fill=\'%2364748b\'><path d=\'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z\'/></svg>';" />
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
    // Live validation & duplicate check for Client Name
    const clientNameInput = document.getElementById("client-name");
    if (clientNameInput) {
        const validateAndCheckDupName = () => {
            const val = clientNameInput.value;
            if (/\d/.test(val)) {
                setInputError(clientNameInput, "Client name cannot contain numbers. Only letters are allowed.");
                return;
            } else if (val && !/^[A-Za-z\s\.\'\-]*$/.test(val)) {
                setInputError(clientNameInput, "Client name can only contain letters, spaces, hyphens, and apostrophes.");
                return;
            } else {
                clearInputError(clientNameInput);
            }

            const clean = val.trim();
            if (clean.length >= 2) {
                const dup = findDuplicateClientName(clean);
                if (dup) {
                    setInputWarning(clientNameInput, `Client name "${dup.name}" is already registered.`);
                } else {
                    clearInputWarning(clientNameInput);
                }
            } else {
                clearInputWarning(clientNameInput);
            }
        };

        clientNameInput.addEventListener("input", validateAndCheckDupName);
        clientNameInput.addEventListener("blur", () => {
            const val = clientNameInput.value.trim();
            if (val) {
                const check = validateClientName(val);
                if (!check.valid) {
                    setInputError(clientNameInput, check.error);
                } else {
                    validateAndCheckDupName();
                }
            }
        });
    }

    // Live validation & duplicate check for Client Phone
    const clientPhoneInput = document.getElementById("client-phone");
    if (clientPhoneInput) {
        const validateAndCheckDupPhone = () => {
            const val = clientPhoneInput.value;
            if (/[a-zA-Z]/.test(val)) {
                setInputError(clientPhoneInput, "Phone number cannot contain letters. Numbers only (e.g. +94 77 123 4567).");
                return;
            } else if (val && !/^\+?[0-9\s\-\(\)]*$/.test(val)) {
                setInputError(clientPhoneInput, "Phone number contains invalid characters. Numbers, +, -, and spaces only.");
                return;
            } else {
                clearInputError(clientPhoneInput);
            }

            const clean = val.trim();
            if (clean.length >= 7) {
                const dup = findDuplicateClientPhone(clean);
                if (dup) {
                    setInputWarning(clientPhoneInput, `Phone number is already registered to "${dup.name}".`);
                } else {
                    clearInputWarning(clientPhoneInput);
                }
            } else {
                clearInputWarning(clientPhoneInput);
            }
        };

        clientPhoneInput.addEventListener("input", validateAndCheckDupPhone);
        clientPhoneInput.addEventListener("blur", () => {
            const val = clientPhoneInput.value.trim();
            if (val) {
                const check = validateClientPhone(val);
                if (!check.valid) {
                    setInputError(clientPhoneInput, check.error);
                } else {
                    validateAndCheckDupPhone();
                }
            }
        });
    }

    // Live validation & duplicate check for Client Email
    const clientEmailInput = document.getElementById("client-email");
    if (clientEmailInput) {
        const validateAndCheckDupEmail = () => {
            const val = clientEmailInput.value;
            if (/\s/.test(val)) {
                setInputError(clientEmailInput, "Email address cannot contain spaces.");
                return;
            } else {
                clearInputError(clientEmailInput);
            }

            const clean = val.trim();
            if (clean.length >= 4 && clean.includes("@")) {
                const dup = findDuplicateClientEmail(clean);
                if (dup) {
                    setInputWarning(clientEmailInput, `Email is already registered to "${dup.name}".`);
                } else {
                    clearInputWarning(clientEmailInput);
                }
            } else {
                clearInputWarning(clientEmailInput);
            }
        };

        clientEmailInput.addEventListener("input", validateAndCheckDupEmail);
        clientEmailInput.addEventListener("blur", () => {
            const val = clientEmailInput.value.trim();
            if (val) {
                const check = validateClientEmail(val);
                if (!check.valid) {
                    setInputError(clientEmailInput, check.error);
                } else {
                    validateAndCheckDupEmail();
                }
            }
        });
    }

    // Live duplicate check for Booking Form
    const bookingClientSelect = document.getElementById("booking-client");
    const bookingTitleInput = document.getElementById("booking-title");
    function checkBookingDuplicateLive() {
        if (!bookingClientSelect || !bookingTitleInput) return;
        const cId = bookingClientSelect.value;
        const title = bookingTitleInput.value.trim();
        if (cId && title.length >= 2) {
            const dup = findDuplicateBooking(cId, title);
            if (dup) {
                setInputWarning(bookingTitleInput, `A booking titled "${title}" already exists for this client.`);
                return;
            }
        }
        clearInputWarning(bookingTitleInput);
    }
    if (bookingClientSelect) bookingClientSelect.addEventListener("change", checkBookingDuplicateLive);
    if (bookingTitleInput) {
        bookingTitleInput.addEventListener("input", checkBookingDuplicateLive);
        bookingTitleInput.addEventListener("blur", checkBookingDuplicateLive);
    }

    // Live duplicate check for Event Form
    const eventBookingSelect = document.getElementById("event-booking");
    const eventNameInput = document.getElementById("event-name");
    const eventDateInput = document.getElementById("event-date");
    const eventTimeInput = document.getElementById("event-time");
    function checkEventDuplicateLive() {
        if (!eventBookingSelect || !eventNameInput) return;
        const bId = eventBookingSelect.value;
        const name = eventNameInput.value.trim();
        if (bId && name.length >= 2) {
            const dupName = findDuplicateEventName(bId, name);
            if (dupName) {
                setInputWarning(eventNameInput, `An event named "${name}" already exists for this booking.`);
            } else {
                clearInputWarning(eventNameInput);
            }
        } else {
            clearInputWarning(eventNameInput);
        }

        if (bId && eventDateInput && eventTimeInput) {
            const dVal = eventDateInput.value;
            const tVal = eventTimeInput.value.trim();
            if (dVal && tVal) {
                const dupSlot = findDuplicateEventSlot(bId, dVal, tVal);
                if (dupSlot) {
                    setInputWarning(eventTimeInput, `Slot already booked for event "${dupSlot.name}".`);
                    return;
                }
            }
            clearInputWarning(eventTimeInput);
        }
    }
    if (eventBookingSelect) eventBookingSelect.addEventListener("change", checkEventDuplicateLive);
    if (eventNameInput) {
        eventNameInput.addEventListener("input", checkEventDuplicateLive);
        eventNameInput.addEventListener("blur", checkEventDuplicateLive);
    }
    if (eventDateInput) {
        eventDateInput.addEventListener("change", checkEventDuplicateLive);
        eventDateInput.addEventListener("input", checkEventDuplicateLive);
    }
    if (eventTimeInput) {
        eventTimeInput.addEventListener("change", checkEventDuplicateLive);
        eventTimeInput.addEventListener("input", checkEventDuplicateLive);
    }

    // Generic clear errors for other fields on input
    [clientForm, bookingForm, eventForm].forEach(form => {
        if (!form) return;
        form.querySelectorAll("input, select, textarea").forEach(field => {
            if (field !== clientNameInput && field !== clientPhoneInput && field !== clientEmailInput &&
                field !== bookingTitleInput && field !== eventNameInput && field !== eventTimeInput) {
                field.addEventListener("input", () => clearInputError(field));
                field.addEventListener("change", () => clearInputError(field));
            }
        });
    });

    const bookingDate = document.getElementById("booking-date");
    const eventDate = document.getElementById("event-date");
    const eventTime = document.getElementById("event-time");
    const bookingStatus = document.getElementById("booking-status");
    const eventStatus = document.getElementById("event-status");

    if (bookingDate && !bookingDate.value) bookingDate.value = todayLocalIso();
    if (eventDate && !eventDate.value) eventDate.value = todayLocalIso();
    if (eventTime && !eventTime.value) eventTime.value = "10:00";

    // Preset chip listeners for date fields (booking-date, event-date)
    document.querySelectorAll("button.btn-chip[data-set-date]").forEach(chip => {
        chip.addEventListener("click", () => {
            const targetId = chip.dataset.setDate;
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;
            const days = parseInt(chip.dataset.days || "0", 10);
            const d = new Date();
            d.setDate(d.getDate() + days);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            targetInput.value = `${y}-${m}-${day}`;
            clearInputError(targetInput);
            targetInput.dispatchEvent(new Event("input", { bubbles: true }));
            targetInput.dispatchEvent(new Event("change", { bubbles: true }));
            updateChipState(targetInput);
        });
    });

    // Preset chip listeners for time field (event-time)
    document.querySelectorAll("button.btn-chip[data-set-time]").forEach(chip => {
        chip.addEventListener("click", () => {
            const targetId = chip.dataset.setTime;
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;
            const timeVal = chip.dataset.val;
            if (timeVal) {
                targetInput.value = timeVal;
                clearInputError(targetInput);
                targetInput.dispatchEvent(new Event("input", { bubbles: true }));
                targetInput.dispatchEvent(new Event("change", { bubbles: true }));
                updateChipState(targetInput);
            }
        });
    });

    // Preset chip listeners for status fields (booking-status, event-status)
    document.querySelectorAll("button.btn-chip[data-set-status]").forEach(chip => {
        chip.addEventListener("click", () => {
            const targetId = chip.dataset.setStatus;
            const targetSelect = document.getElementById(targetId);
            if (!targetSelect) return;
            const statusVal = chip.dataset.val;
            if (statusVal) {
                targetSelect.value = statusVal;
                targetSelect.dispatchEvent(new Event("change", { bubbles: true }));
                updateChipState(targetSelect);
            }
        });
    });

    // Interactive Calendar & Time Picker: click anywhere on date/time inputs to open picker
    document.querySelectorAll('input[type="date"], input[type="time"]').forEach(input => {
        input.addEventListener("click", function(e) {
            try {
                if (typeof this.showPicker === "function") {
                    this.showPicker();
                }
            } catch (_) {}
        });
        input.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                try {
                    if (typeof this.showPicker === "function") {
                        e.preventDefault();
                        this.showPicker();
                    }
                } catch (_) {}
            }
        });
    });

    // Explicit [data-open-picker] triggers (buttons & chips)
    document.querySelectorAll("[data-open-picker]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetId = btn.dataset.openPicker;
            const target = document.getElementById(targetId);
            if (!target) return;
            try {
                if (typeof target.showPicker === "function") {
                    target.showPicker();
                    return;
                }
            } catch (_) {}
            if (target.type === "date") {
                showCustomCalendar(target);
            } else {
                target.focus();
            }
        });
    });

    // Sync chip highlights on manual input changes & initialize state
    [bookingDate, eventDate, eventTime].forEach(input => {
        if (!input) return;
        input.addEventListener("input", () => updateChipState(input));
        input.addEventListener("change", () => updateChipState(input));
        updateChipState(input);
    });

    [bookingStatus, eventStatus].forEach(sel => {
        if (!sel) return;
        sel.addEventListener("change", () => updateChipState(sel));
        updateChipState(sel);
    });

    const dashClient = document.getElementById("dash-goto-client");
    const dashBooking = document.getElementById("dash-goto-booking");
    const dashEvent = document.getElementById("dash-goto-event");
    if (dashClient) dashClient.addEventListener("click", () => showSection("section-clients"));
    if (dashBooking) dashBooking.addEventListener("click", () => showSection("section-bookings"));
    if (dashEvent) dashEvent.addEventListener("click", () => showSection("section-events"));
}

// ---------------------------------------------------------------------------
// Standalone / Fallback Interactive Calendar Popover
// ---------------------------------------------------------------------------
let _activeCalendarPopover = null;

function closeCustomCalendar() {
    if (_activeCalendarPopover) {
        _activeCalendarPopover.remove();
        _activeCalendarPopover = null;
    }
}

function showCustomCalendar(targetInput) {
    if (!targetInput) return;
    closeCustomCalendar();

    let curDate = new Date();
    if (targetInput.value && /^\d{4}-\d{2}-\d{2}$/.test(targetInput.value)) {
        const parts = targetInput.value.split("-").map(Number);
        curDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }

    let viewYear = curDate.getFullYear();
    let viewMonth = curDate.getMonth();

    const popover = document.createElement("div");
    popover.className = "custom-cal-popover";
    document.body.appendChild(popover);
    _activeCalendarPopover = popover;

    const rect = targetInput.getBoundingClientRect();
    popover.style.top = `${window.scrollY + rect.bottom + 4}px`;
    popover.style.left = `${Math.max(10, window.scrollX + rect.left)}px`;

    function renderMonth(y, m) {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const firstDayIdx = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const selectedVal = targetInput.value || "";

        let html = `
            <div class="cal-nav">
                <button type="button" class="cal-nav-btn" id="cal-prev">&#9664;</button>
                <span class="cal-nav-title">${monthNames[m]} ${y}</span>
                <button type="button" class="cal-nav-btn" id="cal-next">&#9654;</button>
            </div>
            <div class="cal-weekdays">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
            </div>
            <div class="cal-days-grid">
        `;

        for (let i = 0; i < firstDayIdx; i++) {
            html += `<div class="cal-day-cell cal-empty"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            let cellCls = "cal-day-cell";
            if (dateStr === todayStr) cellCls += " cal-today";
            if (dateStr === selectedVal) cellCls += " cal-selected";
            html += `<div class="${cellCls}" data-cal-date="${dateStr}">${d}</div>`;
        }

        html += `
            </div>
            <div class="cal-footer">
                <button type="button" class="cal-footer-btn" id="cal-today-btn">Today</button>
                <button type="button" class="cal-footer-btn" id="cal-close-btn">Close</button>
            </div>
        `;

        popover.innerHTML = html;

        popover.querySelector("#cal-prev")?.addEventListener("click", (e) => {
            e.stopPropagation();
            viewMonth--;
            if (viewMonth < 0) { viewMonth = 11; viewYear--; }
            renderMonth(viewYear, viewMonth);
        });

        popover.querySelector("#cal-next")?.addEventListener("click", (e) => {
            e.stopPropagation();
            viewMonth++;
            if (viewMonth > 11) { viewMonth = 0; viewYear++; }
            renderMonth(viewYear, viewMonth);
        });

        popover.querySelectorAll(".cal-day-cell[data-cal-date]").forEach(cell => {
            cell.addEventListener("click", (e) => {
                e.stopPropagation();
                const picked = cell.dataset.calDate;
                targetInput.value = picked;
                clearInputError(targetInput);
                targetInput.dispatchEvent(new Event("input", { bubbles: true }));
                targetInput.dispatchEvent(new Event("change", { bubbles: true }));
                updateChipState(targetInput);
                closeCustomCalendar();
            });
        });

        popover.querySelector("#cal-today-btn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            targetInput.value = todayLocalIso();
            clearInputError(targetInput);
            targetInput.dispatchEvent(new Event("input", { bubbles: true }));
            targetInput.dispatchEvent(new Event("change", { bubbles: true }));
            updateChipState(targetInput);
            closeCustomCalendar();
        });

        popover.querySelector("#cal-close-btn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            closeCustomCalendar();
        });
    }

    renderMonth(viewYear, viewMonth);

    function onDocClick(e) {
        if (!popover.contains(e.target) && e.target !== targetInput) {
            closeCustomCalendar();
            document.removeEventListener("click", onDocClick);
        }
    }
    setTimeout(() => document.addEventListener("click", onDocClick), 50);
}

async function updateApiStatus() {
    const dot = document.getElementById("api-dot");
    const mobileDot = document.getElementById("mobile-api-dot");
    const text = document.getElementById("api-status-text");
    if (!dot || !text) return;
    try {
        const [healthRes, dbRes] = await Promise.all([
            fetch(`${API_BASE}/api/health`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${API_BASE}/api/db-health`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        if (healthRes) {
            dot.className = "status-dot online";
            if (mobileDot) mobileDot.className = "status-dot online";

            if (dbRes && dbRes.status === "ok") {
                text.innerHTML = `Online &bull; <span style="color:#34d399;font-weight:600;" title="Database is connected and ready">Database Connected</span>`;
            } else {
                text.innerHTML = `Online &bull; <span style="color:#f87171;font-weight:600;" title="Database connection issue">Database Disconnected</span>`;
            }
        } else {
            dot.className = "status-dot offline";
            if (mobileDot) mobileDot.className = "status-dot offline";
            text.textContent = "Offline";
        }
    } catch (_) {
        dot.className = "status-dot offline";
        if (mobileDot) mobileDot.className = "status-dot offline";
        text.textContent = "API Offline";
    }
}

// ---------------------------------------------------------------------------
// Fullscreen Photo Preview Lightbox
// ---------------------------------------------------------------------------
let _lightboxWired = false;

function openPhotoLightbox(photoId, customList = null) {
    if (customList && customList.length > 0) {
        _currentGalleryPhotos = customList;
    }
    const idx = _currentGalleryPhotos.findIndex(p => p.id === photoId);
    if (idx !== -1) {
        _currentLightboxIndex = idx;
    } else if (_currentGalleryPhotos.length > 0) {
        _currentLightboxIndex = 0;
    } else {
        return;
    }

    const modal = document.getElementById("photo-lightbox");
    if (!modal) return;

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    updateLightboxContent();
}

function closePhotoLightbox() {
    const modal = document.getElementById("photo-lightbox");
    if (!modal) return;
    modal.style.display = "none";
    document.body.style.overflow = "";
    const img = document.getElementById("lightbox-img");
    if (img) {
        img.src = "";
        img.classList.remove("zoomed");
    }
    _lightboxZoomed = false;
    _currentLightboxIndex = -1;
}

function navigateLightbox(direction) {
    if (_currentGalleryPhotos.length === 0) return;
    _currentLightboxIndex = (_currentLightboxIndex + direction + _currentGalleryPhotos.length) % _currentGalleryPhotos.length;
    updateLightboxContent();
}

function toggleLightboxZoom() {
    _lightboxZoomed = !_lightboxZoomed;
    const img = document.getElementById("lightbox-img");
    const zoomBtn = document.getElementById("lightbox-btn-zoom");
    if (img) {
        if (_lightboxZoomed) {
            img.classList.add("zoomed");
        } else {
            img.classList.remove("zoomed");
        }
    }
    if (zoomBtn) {
        zoomBtn.innerHTML = _lightboxZoomed
            ? `<span>🔍</span> <span class="action-text">Fit</span>`
            : `<span>🔍</span> <span class="action-text">Zoom</span>`;
    }
}

async function applyLightboxDecision(decision) {
    if (_currentLightboxIndex < 0 || !_currentGalleryPhotos[_currentLightboxIndex]) return;
    const photo = _currentGalleryPhotos[_currentLightboxIndex];
    const photoId = photo.id;

    const keepBtn = document.getElementById("lightbox-keep-btn");
    const rejectBtn = document.getElementById("lightbox-reject-btn");
    if (keepBtn) keepBtn.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;

    try {
        const result = await setDecision(photoId, decision);
        if (!photo.analysis) photo.analysis = {};
        photo.analysis.photographer_decision = result.photographer_decision;

        // If gallery card is in DOM, update it
        const card = document.getElementById(`photo-card-${photoId}`);
        if (card) {
            card.classList.remove("card-selected", "card-rejected");
            if (result.photographer_decision === "keep")   card.classList.add("card-selected");
            if (result.photographer_decision === "reject") card.classList.add("card-rejected");

            const thumbWrap = card.querySelector(".photo-thumb-wrap");
            if (thumbWrap) {
                thumbWrap.querySelectorAll(".card-decision-banner").forEach(b => b.remove());
                if (result.photographer_decision === "keep") {
                    thumbWrap.insertAdjacentHTML("beforeend", '<div class="card-decision-banner banner-keep">&#10003; Selected</div>');
                } else if (result.photographer_decision === "reject") {
                    thumbWrap.insertAdjacentHTML("beforeend", '<div class="card-decision-banner banner-reject">&#10007; Rejected</div>');
                }
            }

            const decisionZone = document.getElementById(`decision-zone-${photoId}`);
            if (decisionZone) {
                decisionZone.outerHTML = renderDecisionSection(photoId, result.photographer_decision);
                const newZone = document.getElementById(`decision-zone-${photoId}`);
                if (newZone) {
                    newZone.querySelectorAll(".btn-decision").forEach(btn => {
                        btn.addEventListener("click", () =>
                            handleDecision(parseInt(btn.dataset.photoId), btn.dataset.decision)
                        );
                    });
                }
            }
        }

        // If burst card is in DOM, update it
        const burstCard = document.getElementById(`burst-card-${photoId}`);
        if (burstCard) {
            const bThumb = burstCard.querySelector(".photo-thumb-wrap");
            if (bThumb) {
                bThumb.querySelectorAll(".card-decision-banner").forEach(el => el.remove());
                if (result.photographer_decision === "keep") {
                    bThumb.insertAdjacentHTML("beforeend", '<div class="card-decision-banner banner-keep">&#10003; Selected</div>');
                } else if (result.photographer_decision === "reject") {
                    bThumb.insertAdjacentHTML("beforeend", '<div class="card-decision-banner banner-reject">&#10007; Rejected</div>');
                }
            }
            burstCard.querySelectorAll(".btn-decision").forEach(b => {
                if (b.dataset.decision === decision) {
                    b.style.opacity = "1";
                    b.style.fontWeight = "700";
                    b.style.boxShadow = "0 0 0 2px #ffffff";
                } else {
                    b.style.opacity = "0.6";
                    b.style.fontWeight = "normal";
                    b.style.boxShadow = "none";
                }
            });
        }

        refreshSummaryAndActionBar();
        updateLightboxContent();
        showToast(`Photo #${photoId} marked as ${decision === "keep" ? "Keep" : "Reject"}`);
    } catch (err) {
        showToast("Error updating decision: " + err.message, "error");
    } finally {
        if (keepBtn) keepBtn.disabled = false;
        if (rejectBtn) rejectBtn.disabled = false;
    }
}

function updateLightboxContent() {
    if (_currentLightboxIndex < 0 || !_currentGalleryPhotos[_currentLightboxIndex]) return;
    const photo = _currentGalleryPhotos[_currentLightboxIndex];
    const a = photo.analysis;

    const nameEl = document.getElementById("lightbox-filename");
    if (nameEl) nameEl.textContent = photo.original_filename || `Photo #${photo.id}`;

    const countEl = document.getElementById("lightbox-counter");
    if (countEl) countEl.textContent = `Photo ${_currentLightboxIndex + 1} of ${_currentGalleryPhotos.length}`;

    const img = document.getElementById("lightbox-img");
    if (img) {
        img.src = photoFileUrl(photo.id);
        img.alt = photo.original_filename || `Photo #${photo.id}`;
        img.classList.remove("zoomed");
    }
    _lightboxZoomed = false;
    const zoomBtn = document.getElementById("lightbox-btn-zoom");
    if (zoomBtn) {
        zoomBtn.innerHTML = `<span>🔍</span> <span class="action-text">Zoom</span>`;
    }

    const prevBtn = document.getElementById("lightbox-prev");
    const nextBtn = document.getElementById("lightbox-next");
    if (prevBtn && nextBtn) {
        if (_currentGalleryPhotos.length <= 1) {
            prevBtn.style.display = "none";
            nextBtn.style.display = "none";
        } else {
            prevBtn.style.display = "flex";
            nextBtn.style.display = "flex";
        }
    }

    const badgesContainer = document.getElementById("lightbox-badges");
    if (badgesContainer) {
        if (a) {
            const recClass  = a.ai_recommendation === "keep" ? "chip-keep" : "chip-review";
            const recLabel  = a.ai_recommendation === "keep" ? "&#10004; AI: KEEP" : "&#9888; AI: REVIEW";
            const blurLabel = a.is_blurry === true ? "Blurry" : a.is_blurry === false ? "Sharp" : "—";
            const blurClass = a.is_blurry === true ? "chip-review" : "chip-keep";
            const blurScore = (a.blur_score !== null && a.blur_score !== undefined) ? a.blur_score.toFixed(1) : "—";
            const faceLabel = a.face_detected === true ? "Face: Yes" : a.face_detected === false ? "Face: None" : "Face: —";
            const eyeLabel  = a.eyes_status ? `Eyes: ${a.eyes_status}` : "Eyes: —";

            let decisionChip = `<span class="decision-chip chip-undecided">Decision: Undecided</span>`;
            if (a.photographer_decision === "keep") {
                decisionChip = `<span class="decision-chip chip-decided-keep">&#10003; Selected (Keep)</span>`;
            } else if (a.photographer_decision === "reject") {
                decisionChip = `<span class="decision-chip chip-decided-reject">&#10007; Rejected</span>`;
            }

            badgesContainer.innerHTML = `
                <span class="ai-result-chip ${recClass}">${recLabel}</span>
                <span class="ai-result-chip ${blurClass}">&#128269; ${blurLabel} (${blurScore})</span>
                <span class="ai-result-chip chip-neutral">&#128578; ${faceLabel}</span>
                <span class="ai-result-chip chip-neutral">&#128065; ${eyeLabel}</span>
                ${decisionChip}
            `;
        } else {
            badgesContainer.innerHTML = `
                <span class="ai-status-chip chip-pending">Not analysed</span>
                <span class="decision-chip chip-undecided">Decision: Undecided</span>
            `;
        }
    }

    const keepBtn = document.getElementById("lightbox-keep-btn");
    const rejectBtn = document.getElementById("lightbox-reject-btn");
    if (keepBtn && rejectBtn) {
        const dec = a?.photographer_decision;
        if (dec === "keep") {
            keepBtn.style.opacity = "1";
            keepBtn.style.boxShadow = "0 0 0 2px #10b981, 0 4px 12px rgba(16,185,129,0.4)";
            keepBtn.innerHTML = "&#10003; Kept (Selected)";
            rejectBtn.style.opacity = "0.5";
            rejectBtn.style.boxShadow = "none";
            rejectBtn.innerHTML = "&#10007; Reject";
        } else if (dec === "reject") {
            rejectBtn.style.opacity = "1";
            rejectBtn.style.boxShadow = "0 0 0 2px #ef4444, 0 4px 12px rgba(239,68,68,0.4)";
            rejectBtn.innerHTML = "&#10007; Rejected";
            keepBtn.style.opacity = "0.5";
            keepBtn.style.boxShadow = "none";
            keepBtn.innerHTML = "&#10003; Keep";
        } else {
            keepBtn.style.opacity = "1";
            keepBtn.style.boxShadow = "none";
            keepBtn.innerHTML = "&#10003; Keep";
            rejectBtn.style.opacity = "1";
            rejectBtn.style.boxShadow = "none";
            rejectBtn.innerHTML = "&#10007; Reject";
        }
    }
}

function initLightbox() {
    if (_lightboxWired) return;
    _lightboxWired = true;

    const closeBtn = document.getElementById("lightbox-btn-close");
    const backdrop = document.getElementById("lightbox-backdrop");
    const zoomBtn = document.getElementById("lightbox-btn-zoom");
    const img = document.getElementById("lightbox-img");
    const prevBtn = document.getElementById("lightbox-prev");
    const nextBtn = document.getElementById("lightbox-next");
    const keepBtn = document.getElementById("lightbox-keep-btn");
    const rejectBtn = document.getElementById("lightbox-reject-btn");

    if (closeBtn) closeBtn.addEventListener("click", closePhotoLightbox);
    if (backdrop) backdrop.addEventListener("click", closePhotoLightbox);
    if (zoomBtn) zoomBtn.addEventListener("click", toggleLightboxZoom);
    if (img) img.addEventListener("click", toggleLightboxZoom);
    if (prevBtn) prevBtn.addEventListener("click", () => navigateLightbox(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => navigateLightbox(1));
    if (keepBtn) keepBtn.addEventListener("click", () => applyLightboxDecision("keep"));
    if (rejectBtn) rejectBtn.addEventListener("click", () => applyLightboxDecision("reject"));

    document.addEventListener("keydown", (e) => {
        const modal = document.getElementById("photo-lightbox");
        if (!modal || modal.style.display === "none") return;

        if (e.key === "Escape") {
            e.preventDefault();
            closePhotoLightbox();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            navigateLightbox(-1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            navigateLightbox(1);
        } else if (e.key === "k" || e.key === "K") {
            e.preventDefault();
            applyLightboxDecision("keep");
        } else if (e.key === "r" || e.key === "R") {
            e.preventDefault();
            applyLightboxDecision("reject");
        } else if (e.key === "z" || e.key === "Z") {
            e.preventDefault();
            toggleLightboxZoom();
        }
    });

    window.openPhotoLightbox = openPhotoLightbox;
    window.closePhotoLightbox = closePhotoLightbox;
    window.navigateLightbox = navigateLightbox;
    window.toggleLightboxZoom = toggleLightboxZoom;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
wireCreateForms();
initBackNavigationListeners();
initScrollToTop();
initLightbox();
updateApiStatus();
setInterval(updateApiStatus, 15000);
showSection("section-dashboard", { pushHistory: false });
