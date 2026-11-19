-- gear-world-awin, part 3 (19 Nov 2026, review of lessons L197). Additive only, on the network tables of 0002; the Awin
-- tables do not change.
-- 1. Each run row says its state in a word: ok, failed, or held (a network that is built but waits, e.g. Linkwise until
--    its report parameters are known). ok stays 1 / 0, and 2 for held, so a reader of ok never sees a held network as
--    a problem.
ALTER TABLE network_sync_runs ADD COLUMN state TEXT;

-- 2. Small facts the Worker and tools/network-sales-setup.ps1 read back:
--    commit                 the code version (full commit) the Worker runs, so the setup tool never deploys a version
--                           that does not contain it (the live-version guard of lessons L156);
--    daisycon:resume_from   where a Daisycon read stopped when one run's call budget was used up; the next run goes on
--                           from there.
CREATE TABLE IF NOT EXISTS network_sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

-- Note: the view all_network_sales (0002) names columns of awin_transactions, so SQLite refuses ALTER TABLE ... DROP
-- COLUMN on those columns while the view exists. Drop or change the view first (lessons L197).
