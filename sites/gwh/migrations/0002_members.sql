-- Gear World Hub D1 (gear-world-registry): the one member list (lessons L90), November 2026.
-- Additive only: new columns on hub_subscribers and one new table. No row is deleted or changed except that the rows
-- already there get mailerlite_group = 'existing' (so they do not get the automatic welcome email).
-- Run by tools/hub-members.ps1 -Step apply, only after the approval phrase and a backup. SQLite cannot "ADD COLUMN IF
-- NOT EXISTS": the tool reads PRAGMA table_info first and runs only the lines of the columns that are missing.
ALTER TABLE hub_subscribers ADD COLUMN site TEXT;               -- cgw, mgw, ... (the site of the sign-up)
ALTER TABLE hub_subscribers ADD COLUMN first_name TEXT;         -- only from the old Rewards members
ALTER TABLE hub_subscribers ADD COLUMN country TEXT;            -- only from the old Rewards members
ALTER TABLE hub_subscribers ADD COLUMN member_source TEXT;      -- site-form:<site>, rewards:<site>, hub-homepage
ALTER TABLE hub_subscribers ADD COLUMN mailerlite_group TEXT;   -- 'existing' for members from before; else the new group
ALTER TABLE hub_subscribers ADD COLUMN mailerlite_status TEXT;  -- NULL (to copy), 'ok', 'error'
ALTER TABLE hub_subscribers ADD COLUMN mailerlite_tries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hub_subscribers ADD COLUMN mailerlite_synced_at TEXT;
CREATE TABLE IF NOT EXISTS member_rate (
  rl_key TEXT PRIMARY KEY,   -- <site>:<one-way key of the visitor>:<hour>
  hits INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
UPDATE hub_subscribers SET mailerlite_group = 'existing' WHERE mailerlite_group IS NULL;
