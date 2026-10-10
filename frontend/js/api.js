/**
 * api.js — SerendibSuite API client
 *
 * All fetch() calls to the FastAPI backend live here.
 * Every other JS file imports from this module so the base URL
 * is defined in exactly one place.
 */

// Dynamic backend URL — works on localhost, Wi-Fi LAN IP, and physical phones.
export const API_BASE = (typeof window !== "undefined" && window.location && window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://127.0.0.1:8000";

// ---------------------------------------------------------------------------
// Generic helper — wraps fetch, checks for HTTP errors, returns parsed JSON.
// NOTE: Do NOT pass Content-Type for multipart uploads — the browser sets it
// automatically with the correct boundary.
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const headers = isFormData
        ? {}                                      // browser sets multipart boundary
        : { "Content-Type": "application/json" };

    if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'));
        if (match) {
            headers["X-CSRF-Token"] = match[2];
        }
    }

    const response = await fetch(API_BASE + path, {
        headers,
        credentials: "include",
        ...options,
    });

    if (!response.ok) {
        if (response.status === 401 && !path.includes("/api/auth/login")) {
            if (typeof window !== "undefined") {
                window.location.href = "login.html";
            }
        }
        const err = await response.json().catch(() => ({}));
        throw new Error(formatApiError(err, response));
    }

    return response.json();
}

function formatApiError(err, response) {
    const detail = err && err.detail;
    if (typeof detail === "string" && detail.trim()) {
        return detail;
    }
    if (Array.isArray(detail)) {
        const parts = detail.map(item => {
            if (typeof item === "string") return item;
            if (item && item.msg) {
                const cleanMsg = item.msg.replace(/^Value error,\s*/i, "");
                const field = Array.isArray(item.loc)
                    ? item.loc.filter(p => p !== "body").join(".")
                    : "";
                return field ? `${field}: ${cleanMsg}` : cleanMsg;
            }
            return null;
        }).filter(Boolean);
        if (parts.length) return parts.join("; ");
    }
    return `HTTP ${response.status}: ${response.statusText}`;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
export async function registerUser(data) {
    return apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function loginUser(data) {
    return apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function logoutUser() {
    return apiFetch("/api/auth/logout", {
        method: "POST",
    });
}

export async function getCurrentUser() {
    return apiFetch("/api/auth/me", {
        method: "GET",
    });
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
export async function getClients() {
    return apiFetch("/api/clients/");
}

export async function getClient(id) {
    return apiFetch(`/api/clients/${id}`);
}

export async function createClient(data) {
    return apiFetch("/api/clients/", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function updateClient(id, data) {
    return apiFetch(`/api/clients/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export async function deleteClient(id) {
    return apiFetch(`/api/clients/${id}`, {
        method: "DELETE",
    });
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
export async function getBookings() {
    return apiFetch("/api/bookings/");
}

export async function getBooking(id) {
    return apiFetch(`/api/bookings/${id}`);
}

export async function createBooking(data) {
    return apiFetch("/api/bookings/", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function updateBooking(id, data) {
    return apiFetch(`/api/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export async function deleteBooking(id) {
    return apiFetch(`/api/bookings/${id}`, {
        method: "DELETE",
    });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export async function getEvents() {
    return apiFetch("/api/events/");
}

export async function getEvent(id) {
    return apiFetch(`/api/events/${id}`);
}

export async function createEvent(data) {
    return apiFetch("/api/events/", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function updateEvent(id, data) {
    return apiFetch(`/api/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export async function deleteEvent(id) {
    return apiFetch(`/api/events/${id}`, {
        method: "DELETE",
    });
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * Upload a single image file for an event.
 * Uses multipart/form-data — NOT JSON.
 */
export async function uploadPhoto(eventId, file) {
    const form = new FormData();
    form.append("event_id", String(eventId));
    form.append("file", file);

    return apiFetch("/api/photos/", {
        method: "POST",
        body: form,   // FormData → browser sets Content-Type automatically
    });
}

/**
 * List all photos for an event.
 */
export async function getPhotosByEvent(eventId) {
    return apiFetch(`/api/photos/?event_id=${eventId}`);
}

/**
 * Get metadata for one photo.
 */
export async function getPhoto(id) {
    return apiFetch(`/api/photos/${id}`);
}

/**
 * Returns the URL to display a photo thumbnail.
 * The browser fetches this directly as an <img src>.
 */
export function photoFileUrl(photoId) {
    return `${API_BASE}/api/photos/${photoId}/file`;
}

/**
 * Run AI analysis on a photo.
 */
export async function analysePhoto(photoId) {
    return apiFetch(`/api/photos/${photoId}/analyse`, { method: "POST" });
}

/**
 * Fetch all photos for an event with their analysis embedded.
 * Returns PhotoWithAnalysis[] where each item has an optional .analysis object.
 */
export async function getPhotosWithAnalysis(eventId) {
    const query = (eventId !== undefined && eventId !== null) ? `?event_id=${eventId}` : "";
    return apiFetch(`/api/photos/with-analysis${query}`);
}

/**
 * Set the photographer's decision for a photo.
 * decision must be "keep" or "reject".
 */
export async function setDecision(photoId, decision) {
    return apiFetch(`/api/photos/${photoId}/decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
    });
}

/**
 * Fetch near-duplicate / burst photo groups for an event.
 */
export async function getBurstGroups(eventId, maxDistance = 10) {
    return apiFetch(`/api/photos/burst-groups?event_id=${eventId}&max_distance=${maxDistance}`);
}

/**
 * Fetch personalization insights and adaptive learning metrics.
 */
export async function getPersonalizationInsights() {
    return apiFetch("/api/photos/personalization-insights");
}

/**
 * URL to download the Adobe Lightroom / Photo Mechanic XMP sidecars ZIP.
 */
export function xmpExportUrl(eventId) {
    return `${API_BASE}/api/photos/export-xmp?event_id=${eventId}`;
}
