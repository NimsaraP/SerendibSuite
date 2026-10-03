/**
 * api.js — SerendibSuite API client
 *
 * All fetch() calls to the FastAPI backend live here.
 * Every other JS file imports from this module so the base URL
 * is defined in exactly one place.
 */

// Change this if your FastAPI server runs on a different port.
const API_BASE = "http://127.0.0.1:8000";

// ---------------------------------------------------------------------------
// Generic helper — wraps fetch, checks for HTTP errors, returns parsed JSON.
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
    const response = await fetch(API_BASE + path, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });

    if (!response.ok) {
        // Try to parse the FastAPI error detail, fall back to status text.
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
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
