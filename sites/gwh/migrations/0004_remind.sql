-- Gear World Hub D1 (gear-world-registry): "Remind me on 27 Nov" of the 13 sites (lessons L182), November 2026.
-- Applied by tools/gwh-remind-d1.ps1 -Apply (approval ΕΓΚΡΙΝΩ REMIND ME D1, D1 Time Travel restore point first).
-- Additive only: one new table and its index. Rollback: DROP TABLE IF EXISTS remind_signups; (the Hub code then
-- answers the sites that the list is closed, so their box goes away by itself).
-- The cron of the Hub deletes every row from 28 Nov 2026 12:00 UTC (remind.js).
CREATE TABLE IF NOT EXISTS remind_signups (
  email TEXT PRIMARY KEY,                       -- lower case
  items TEXT NOT NULL,                          -- JSON: up to 3 { site, id, name, url, at }, newest first
  consent_version TEXT NOT NULL,                -- 2026-11-19-remind
  ml_status TEXT NOT NULL DEFAULT 'pending',    -- pending, synced, failed
  ml_attempts INTEGER NOT NULL DEFAULT 0,
  ml_error TEXT,
  ml_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_remind_signups_pending ON remind_signups (ml_status, updated_at);
