-- Daily price log of the 13 Gear World sites (lessons L100), in its own D1 database gear-world-prices.
-- Written ONLY by the private Worker gear-world-prices (sites/prices/worker.js). The sites' own databases are only read.
-- A product gets a row only when its price, the shop's "was" price, its stock or whether the site shows it changes,
-- or the first time it is seen. Nothing about visitors is kept here.

-- The last state of every product, to see what changed today. One row per site and product.
CREATE TABLE IF NOT EXISTS price_last (
  site TEXT NOT NULL,          -- cgw, mgw, wgw, kgw, hgw, ggw, tgw, agw, vgw, sgw, bgw, pgw, zgw
  pkey TEXT NOT NULL,          -- product key: stable_key (new sites), "<retailer>:<merchant product id>" (older sites)
  price REAL NOT NULL,         -- GBP, rounded to 2 decimals
  was_price REAL,              -- the shop's own "was" price from its feed (new sites only), else NULL
  in_stock INTEGER NOT NULL,   -- 1 in stock, 0 not
  listed INTEGER NOT NULL,     -- 1 the site shows it (is_active = 1), 0 it left the site
  day TEXT NOT NULL,           -- YYYY-MM-DD (UTC) of the last change
  PRIMARY KEY (site, pkey)
) WITHOUT ROWID;

-- The history: one row per site, product and day on which something changed.
CREATE TABLE IF NOT EXISTS price_log (
  site TEXT NOT NULL,
  pkey TEXT NOT NULL,
  day TEXT NOT NULL,           -- YYYY-MM-DD (UTC)
  price REAL NOT NULL,
  was_price REAL,
  in_stock INTEGER NOT NULL,
  listed INTEGER NOT NULL,
  PRIMARY KEY (site, pkey, day)
) WITHOUT ROWID;

-- One row per day and site: what the Worker read and wrote, how long it took, and the error if there was one.
CREATE TABLE IF NOT EXISTS price_runs (
  day TEXT NOT NULL,           -- YYYY-MM-DD (UTC)
  site TEXT NOT NULL,
  status TEXT NOT NULL,        -- running, ok, capped (daily write limit reached), error
  products INTEGER NOT NULL DEFAULT 0, -- products the site shows today
  changed INTEGER NOT NULL DEFAULT 0,  -- price, was price, stock changed, or back on the site
  added INTEGER NOT NULL DEFAULT 0,    -- seen for the first time
  gone INTEGER NOT NULL DEFAULT 0,     -- no longer on the site
  dupes INTEGER NOT NULL DEFAULT 0,    -- the same key twice on the site (the last one is kept)
  skipped INTEGER NOT NULL DEFAULT 0,  -- no key or no valid price: not logged
  writes INTEGER NOT NULL DEFAULT 0,   -- rows written in this database for this site today
  ms INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  PRIMARY KEY (day, site)
) WITHOUT ROWID;
