-- Travel Gear World - initial schema (same as Technology Gear World).
-- Applied with: wrangler d1 migrations apply <db> (needs owner approval for --remote).

-- Products: one row per retailer product. stable_key = "<awin_advertiser_id>:<merchant_product_id>".
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stable_key TEXT NOT NULL UNIQUE,
  awin_advertiser_id INTEGER NOT NULL,
  awin_product_id TEXT,
  merchant_product_id TEXT NOT NULL,
  retailer TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  subcategory TEXT,
  brand TEXT,
  product_name TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL CHECK (price > 0),
  was_price REAL CHECK (was_price IS NULL OR was_price > 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  in_stock INTEGER NOT NULL DEFAULT 1 CHECK (in_stock IN (0, 1)),
  item_condition TEXT NOT NULL DEFAULT 'new' CHECK (item_condition IN ('new', 'refurbished', 'used')),
  image_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  merchant_category TEXT,
  gtin TEXT,
  mpn TEXT,
  specs_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_products_category ON products (is_active, category_slug, price);
CREATE INDEX idx_products_active_seen ON products (is_active, first_seen_at);
CREATE INDEX idx_products_brand ON products (is_active, brand);
CREATE INDEX idx_products_retailer ON products (is_active, retailer);

-- Full-text search over products (kept in sync by triggers).
CREATE VIRTUAL TABLE products_fts USING fts5 (
  product_name,
  brand,
  subcategory,
  retailer,
  content = 'products',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts (rowid, product_name, brand, subcategory, retailer)
  VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer);
END;

CREATE TRIGGER products_fts_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts (products_fts, rowid, product_name, brand, subcategory, retailer)
  VALUES ('delete', old.id, old.product_name, old.brand, old.subcategory, old.retailer);
END;

CREATE TRIGGER products_fts_au AFTER UPDATE OF product_name, brand, subcategory, retailer ON products BEGIN
  INSERT INTO products_fts (products_fts, rowid, product_name, brand, subcategory, retailer)
  VALUES ('delete', old.id, old.product_name, old.brand, old.subcategory, old.retailer);
  INSERT INTO products_fts (rowid, product_name, brand, subcategory, retailer)
  VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer);
END;

-- Clicks to retailers through /out/<id>. No personal data: no IP, no full user agent.
CREATE TABLE affiliate_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  product_id INTEGER NOT NULL,
  awin_advertiser_id INTEGER,
  retailer TEXT,
  category_slug TEXT,
  page_path TEXT,
  country_code TEXT,
  click_ref TEXT
);

CREATE INDEX idx_clicks_date ON affiliate_clicks (clicked_at);
CREATE INDEX idx_clicks_product ON affiliate_clicks (product_id);

-- Newsletter sign-ups (email and consent only).
CREATE TABLE newsletter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  consent_text TEXT NOT NULL,
  source_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Simple fixed-window rate limits (key = route + hashed client + window).
CREATE TABLE rate_limits (
  rl_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

-- One row per product import, written by the import tool.
CREATE TABLE import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL,
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  deactivated INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
