-- gear-world-awin, part 2 (19 Nov 2026, lessons L197): the sales of the affiliate networks other than Awin (CJ, Daisycon,
-- Linkwise now; Rakuten, Admitad, bol.com, eBay later), copied by the private Worker gear-world-network-sync
-- (src/network-sync.js). Only NEW tables and one view: awin_transactions, awin_advertisers and awin_sync_runs are not
-- changed, so the Awin sync (gear-world-awin-sync) works exactly as before.
-- Read-only towards the networks. No customer data: no order number, IP address, country, device or basket is kept,
-- only the fields below. The site and product come from our own sub id ("cgw-82540"), the same form as the Awin clickref.
CREATE TABLE IF NOT EXISTS network_transactions (
  network TEXT NOT NULL,               -- cj, daisycon, linkwise, ...
  id TEXT NOT NULL,                    -- the network's transaction id (Daisycon: <transaction>-<part>)
  site TEXT NOT NULL DEFAULT 'unknown',-- cgw, mgw, ... or 'unknown' (no sub id, or not one of ours)
  sub_id TEXT,                         -- our sub id as the network gave it back: <site code>-<product id>
  product_ref TEXT,                    -- the part after the site code
  advertiser_id TEXT,
  advertiser_name TEXT,
  sale_date TEXT,                      -- when the sale happened (CJ event date, Daisycon date)
  locking_date TEXT,                   -- approval or locking date, if the network gives one
  status TEXT NOT NULL,                -- pending, approved, declined (the same three words for every network)
  raw_status TEXT,                     -- the network's own word(s), e.g. CJ "locked", Daisycon "disapproved"
  sale_amount REAL,
  commission_amount REAL,
  currency TEXT,                       -- the currency of the two amounts above
  sale_amount_gbp REAL,                -- only when the network gives the amount in pounds (our publisher currency)
  commission_amount_gbp REAL,
  is_correction INTEGER NOT NULL DEFAULT 0, -- CJ: a correction of an earlier sale (its amounts are a difference, often negative)
  group_ref TEXT,                      -- CJ: the original action id, the same for a sale and its corrections
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (network, id)
);
CREATE INDEX IF NOT EXISTS idx_network_tx_date ON network_transactions (sale_date);
CREATE INDEX IF NOT EXISTS idx_network_tx_site ON network_transactions (site);
CREATE INDEX IF NOT EXISTS idx_network_tx_group ON network_transactions (network, group_ref);

-- One row per network per run (a network that is not set up at all writes none), so the dashboard can show when each
-- network's last good sync was and why one failed. Never a secret in a message. Only the newest 600 are kept.
CREATE TABLE IF NOT EXISTS network_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  network TEXT NOT NULL,
  ok INTEGER NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  fetched INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  message TEXT
);
CREATE INDEX IF NOT EXISTS idx_network_runs_net ON network_sync_runs (network, id);

-- A network whose sign-in key changes at every use (Daisycon: a refresh token can be used once and lasts 30 days) keeps
-- the newest one here, ENCRYPTED (AES-GCM) with the key held only as the Worker secret NETWORK_SYNC_KEY. A copy of this
-- database (backup, export) therefore never holds a usable key. seed_hash says which sign-in from the setup tool it
-- continues (SHA-256 of that first key), so a new sign-in made with the setup tool replaces it.
CREATE TABLE IF NOT EXISTS network_oauth (
  network TEXT PRIMARY KEY,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  seed_hash TEXT,
  updated_at TEXT NOT NULL
);

-- Every sale of every network in one list for the dashboard: Awin (awin_transactions, unchanged) and the others, with the
-- status in the same three words and the amounts in pounds where the network gave pounds.
CREATE VIEW IF NOT EXISTS all_network_sales AS
  SELECT 'awin' AS network, id, site, click_ref AS sub_id, product_ref, advertiser_id, NULL AS advertiser_name,
    transaction_date AS sale_date, validation_date AS locking_date,
    CASE WHEN status = 'approved' THEN 'approved' WHEN status IN ('declined', 'deleted') THEN 'declined' ELSE 'pending' END AS status,
    status AS raw_status, sale_amount, commission_amount, commission_currency AS currency,
    CASE WHEN sale_currency = 'GBP' THEN sale_amount END AS sale_amount_gbp,
    CASE WHEN commission_currency = 'GBP' THEN commission_amount END AS commission_amount_gbp,
    0 AS is_correction, NULL AS group_ref, first_seen_at, updated_at
  FROM awin_transactions
  UNION ALL
  SELECT network, id, site, sub_id, product_ref, advertiser_id, advertiser_name, sale_date, locking_date, status, raw_status,
    sale_amount, commission_amount, currency, sale_amount_gbp, commission_amount_gbp, is_correction, group_ref,
    first_seen_at, updated_at
  FROM network_transactions;
