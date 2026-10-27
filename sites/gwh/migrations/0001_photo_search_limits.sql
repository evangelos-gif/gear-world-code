-- Gear World Hub D1 (gear-world-registry): fair-use counters for the photo search, October 2026.
-- Additive only: two new tables. No existing table changes. Safe to run twice (IF NOT EXISTS).
-- Run by tools/gwh-photo.ps1 -Step preview, only after the approval phrase and a Time Travel restore point.
--
-- photo_search_usage: one row per visitor and hour. "visitor" is a one-way code that changes every day
--   (SHA-256 of a secret, the day and the IP address). The IP address itself is never stored.
--   Rows older than 48 hours are deleted by the Worker.
-- photo_search_daily: one row per day with the total number of photo searches (no personal data).

CREATE TABLE IF NOT EXISTS photo_search_usage (
  visitor TEXT NOT NULL,
  hour TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor, hour)
);

CREATE TABLE IF NOT EXISTS photo_search_daily (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
