-- Gear World Hub D1 (gear-world-registry): the one member list (lessons L92), November 2026.
-- Ran once on the live database on 02/11/2026 22:11 (tools/hub-members.ps1 -Step apply, approval and backup first),
-- after migrations/0002_mailerlite_sync.sql (21:53). Additive only: new columns on hub_subscribers and one new table.
-- SQLite cannot "ADD COLUMN IF NOT EXISTS": the tool reads PRAGMA table_info first and runs only the missing lines.
-- The mailerlite_* columns are not used any more: the way to MailerLite is mailerlite.js (ml_status, ml_attempts ...).
-- The Rewards members of the older sites are added by the tool with ml_status 'hold' (MailerLite only after approval).
ALTER TABLE hub_subscribers ADD COLUMN site TEXT;               -- cgw, mgw, ... (the site of the sign-up)
ALTER TABLE hub_subscribers ADD COLUMN first_name TEXT;         -- only from the old Rewards members
ALTER TABLE hub_subscribers ADD COLUMN country TEXT;            -- only from the old Rewards members
ALTER TABLE hub_subscribers ADD COLUMN member_source TEXT;      -- site-form:<site>, rewards:<site>, hub-homepage
ALTER TABLE hub_subscribers ADD COLUMN mailerlite_group TEXT;   -- not used any more (was: 'existing' for members from before)
ALTER TABLE hub_subscribers ADD COLUMN mailerlite_status TEXT;  -- not used any more (ml_status is used)
ALTER TABLE hub_subscribers ADD COLUMN mailerlite_tries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hub_subscribers ADD COLUMN mailerlite_synced_at TEXT;
CREATE TABLE IF NOT EXISTS member_rate (
  rl_key TEXT PRIMARY KEY,   -- <site>:<one-way key of the visitor>:<hour>
  hits INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
UPDATE hub_subscribers SET mailerlite_group = 'existing' WHERE mailerlite_group IS NULL;
