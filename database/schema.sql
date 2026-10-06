-- =============================================================================
-- SerendibSuite Database Schema
-- Engine: MySQL / MariaDB (XAMPP)
-- Database: serendibsuite
-- Charset: utf8mb4 (supports full Unicode, including emoji)
--
-- This file documents the schema.  The tables are actually created by
-- SQLAlchemy (Base.metadata.create_all) when the FastAPI server starts.
-- You can also run this file manually in phpMyAdmin or the MySQL CLI.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS serendibsuite
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE serendibsuite;

-- -----------------------------------------------------------------------------
-- 1. users
--    The photographer who logs into SerendibSuite.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT          NOT NULL AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. clients
--    People or organisations that hire the photographer.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id         INT          NOT NULL AUTO_INCREMENT,
    user_id    INT          NOT NULL,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(255) NOT NULL,
    phone      VARCHAR(30)  DEFAULT NULL,
    notes      TEXT         DEFAULT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_clients_user_id (user_id),
    KEY idx_clients_email   (email),
    CONSTRAINT fk_clients_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. bookings
--    A confirmed (or pending) job from a client.
--    status: enquiry | confirmed | completed | cancelled
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
    id           INT          NOT NULL AUTO_INCREMENT,
    client_id    INT          NOT NULL,
    title        VARCHAR(200) NOT NULL,
    booking_date DATE         NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'enquiry',
    notes        TEXT         DEFAULT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_bookings_client_id (client_id),
    KEY idx_bookings_status    (status),
    CONSTRAINT fk_bookings_client
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. events
--    A specific shoot occasion within a booking.
--    Example: "Ceremony" and "Reception" are two Events in one Booking.
--    status: scheduled | in_progress | completed | cancelled
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id         INT          NOT NULL AUTO_INCREMENT,
    booking_id INT          NOT NULL,
    name       VARCHAR(200) NOT NULL,
    event_date DATE         NOT NULL,
    event_time VARCHAR(30)  DEFAULT NULL,
    location   VARCHAR(255) DEFAULT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'scheduled',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_events_booking_id (booking_id),
    KEY idx_events_event_date (event_date),
    KEY idx_events_status     (status),
    CONSTRAINT fk_events_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. photos
--    One uploaded image file, linked to an Event.
--    Binary data is NOT stored here — only filesystem metadata.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
    id                INT           NOT NULL AUTO_INCREMENT,
    event_id          INT           NOT NULL,
    original_filename VARCHAR(255)  NOT NULL,
    stored_filename   VARCHAR(255)  NOT NULL,
    file_path         VARCHAR(500)  NOT NULL,
    mime_type         VARCHAR(50)   NOT NULL,
    file_size         BIGINT        NOT NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_photos_event_id (event_id),
    CONSTRAINT fk_photos_event
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. photo_analysis
--    AI analysis results for one photo (blur, face, eyes, duplicates).
--    All analysis columns are nullable — a photo may not be analysed yet.
--    One-to-one with photos (enforced by UNIQUE on photo_id).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photo_analysis (
    id                    INT         NOT NULL AUTO_INCREMENT,
    photo_id              INT         NOT NULL,
    blur_score            FLOAT       DEFAULT NULL,
    is_blurry             TINYINT(1)  DEFAULT NULL,
    face_detected         TINYINT(1)  DEFAULT NULL,
    eyes_status           VARCHAR(20) DEFAULT NULL,
    similarity_group      VARCHAR(64) DEFAULT NULL,
    ai_recommendation     VARCHAR(10) DEFAULT NULL,
    photographer_decision VARCHAR(10) DEFAULT NULL,
    analyzed_at           DATETIME    DEFAULT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_photo_analysis_photo_id (photo_id),
    CONSTRAINT fk_photo_analysis_photo
        FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. culling_overrides
--    Logs photographer overrides of AI recommendations for adaptive learning.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS culling_overrides (
    id                    INT         NOT NULL AUTO_INCREMENT,
    photo_id              INT         NOT NULL,
    event_id              INT         NOT NULL,
    ai_recommendation     VARCHAR(20) NOT NULL,
    photographer_decision VARCHAR(20) NOT NULL,
    blur_score            FLOAT       DEFAULT NULL,
    is_blurry             TINYINT(1)  DEFAULT NULL,
    face_detected         TINYINT(1)  DEFAULT NULL,
    eyes_status           VARCHAR(20) DEFAULT NULL,
    created_at            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_culling_overrides_photo_id (photo_id),
    KEY idx_culling_overrides_event_id (event_id),
    CONSTRAINT fk_culling_overrides_photo
        FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE,
    CONSTRAINT fk_culling_overrides_event
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
