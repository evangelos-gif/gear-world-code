-- gear-world-awin: the Awin sales of every Gear World site, copied by the private Worker gear-world-awin-sync
-- (src/awin-sync.js, lessons L89). Read-only towards Awin. No customer data: Awin sends none, and the full answer is
-- never stored (only the fields below). The site and product come from our own clickref, e.g. "cgw-82540".
CREATE TABLE IF NOT EXISTS awin_transactions (
  id TEXT PRIMARY KEY,                 -- Awin transaction id
  publisher_id TEXT NOT NULL,
  advertiser_id TEXT,
  type TEXT,                           -- Sale, Lead, Bonus, Commission group transaction, ...
  status TEXT,                         -- pending, approved, declined, deleted
  transaction_date TEXT,
  validation_date TEXT,
  sale_amount REAL,
  sale_currency TEXT,
  commission_amount REAL,
  commission_currency TEXT,
  click_ref TEXT,                      -- our clickref: <site code>-<product id> or <site code>-promo-<promo id>
  site TEXT NOT NULL DEFAULT 'unknown',-- cgw, mgw, ... or 'unknown' (no clickref, or not one of ours)
  product_ref TEXT,                    -- the part after the site code
  paid_to_publisher INTEGER NOT NULL DEFAULT 0,
  decline_reason TEXT,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_awin_tx_date ON awin_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_awin_tx_site ON awin_transactions (site);

-- Shop names (Awin programmes the account has joined), refreshed once a day.
CREATE TABLE IF NOT EXISTS awin_advertisers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One row per sync, so the dashboard can show when the last good one was. Only the newest 300 are kept.
CREATE TABLE IF NOT EXISTS awin_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  fetched INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  message TEXT
);
