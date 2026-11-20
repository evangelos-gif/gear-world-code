-- gear-world-awin, the tables of the daily bol.com price refresh (20 Nov 2026, lessons L205), used by the private Worker
-- gear-world-bol-refresh (src/bol-refresh.js). NEW tables only, in the same database as the sales (next to
-- network_sync_runs, so the Manager's stats page and the 07:40 report read them in one place). The Awin and network
-- tables do not change. These migrations keep their own list (migrations_table d1_migrations_bol_refresh in
-- sites/bol-refresh/wrangler.jsonc.example), so they never mix with the numbers of sites/awin/migrations.
-- Every statement is IF NOT EXISTS / DO NOTHING: the removal tool (tools/bol-remove.ps1 on claude/bol-import) may have
-- made bol_refresh_meta first to turn the switch off, and that '0' is kept.

-- One row per run of the Worker (every hour at :13). ok: 1 good, 0 problem, 2 held (kill switch off; never a problem).
-- state: ok, error or held. Never a key or token in message. Only the newest 1,000 are kept.
CREATE TABLE IF NOT EXISTS bol_refresh_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  state TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,      -- catalog API calls (lists and lookups), tokens not counted
  tokens INTEGER NOT NULL DEFAULT 0,     -- tokens asked (1 per run, at most 3)
  found INTEGER NOT NULL DEFAULT 0,      -- bol.com rows on the sites checked with a current offer
  updated INTEGER NOT NULL DEFAULT 0,    -- of those, rows whose price or stock changed on the site
  hidden INTEGER NOT NULL DEFAULT 0,     -- rows hidden (no offer, or not checked for 24 hours)
  reshown INTEGER NOT NULL DEFAULT 0,    -- rows this Worker had hidden, shown again (bol.com sells them again)
  lookups INTEGER NOT NULL DEFAULT 0,    -- of the calls, one-by-one EAN lookups
  rows_total INTEGER NOT NULL DEFAULT 0, -- bol.com rows the Worker looks after (active, and hidden by it)
  pending INTEGER NOT NULL DEFAULT 0,    -- rows still to check in this cycle after this run
  cycle_at TEXT,                         -- when the cycle of this run started
  message TEXT
);
CREATE INDEX IF NOT EXISTS idx_bol_refresh_runs_ran ON bol_refresh_runs (ran_at);

-- Small facts:
--   enabled  '1' or '0': the kill switch, read at the start of every run. '0' = no bol.com call and no price change; the
--            Worker then only hides bol.com rows not checked for 24 hours. Set to '0' by the removal tool on
--            claude/bol-import (its first step), by tools/bol-refresh-setup.ps1 -Step disable, and by the Worker itself
--            when bol.com answers 401 or 403 (so it does not ask again every hour); only -Step enable sets '1' again.
--            The apply step never turns it on.
--   disabled_reason  why the Worker turned it off (time and message, never a key); cleared by -Step enable;
--   commit   the code version (full commit) the Worker runs, for the setup tool's live-version guard (lessons L156);
--   cycle    where the cycle stands (JSON: its slot, the list and page to go on from, failed lookups).
CREATE TABLE IF NOT EXISTS bol_refresh_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);
INSERT INTO bol_refresh_meta (key, value, updated_at) VALUES ('enabled', '1', datetime('now')) ON CONFLICT (key) DO NOTHING;

-- The Worker's OWN record of when it checked each bol.com row with bol.com (site code + the row id on that site). The
-- sites' updated_at / last_seen_at are written by other tools too (imports, clean-ups), so they never decide whether a
-- bol.com price is fresh: this table does. checked_at: the last check with an answer from bol.com (NULL = never
-- checked yet); first_seen_at: when the Worker first saw the row. A row not checked for 24 hours (or, never checked,
-- seen 24 hours ago) is hidden. WITHOUT ROWID: one write per row (the key is the table).
CREATE TABLE IF NOT EXISTS bol_refresh_checked (
  site TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  ean TEXT,
  checked_at TEXT,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (site, product_id)
) WITHOUT ROWID;

-- The bol.com rows THIS Worker hid, so it may show them again when bol.com sells them again: only for 3 days, and only
-- when the row is still the same as when it was hidden (snap: a fingerprint of its category, subcategory, name and the
-- date it was made). A row hidden by anything else (a clean-up, the removal tool), or changed since, is never shown
-- again by it.
CREATE TABLE IF NOT EXISTS bol_refresh_hidden (
  site TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  ean TEXT,
  reason TEXT,
  hidden_at TEXT NOT NULL,
  snap TEXT,
  PRIMARY KEY (site, product_id)
) WITHOUT ROWID;
