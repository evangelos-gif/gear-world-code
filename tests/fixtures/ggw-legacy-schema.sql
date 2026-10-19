-- The database layout that Garden Gear World (and the other older Gear World sites) already have in
-- production, written by the Hub import router. Used ONLY for local tests and CI (lessons L28).
-- Never apply this to a real database: the real one already exists and must not be changed.
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  awin_product_id TEXT NOT NULL,
  merchant_product_id TEXT,
  retailer TEXT NOT NULL,
  site_category TEXT NOT NULL,
  subcategory TEXT,
  brand TEXT,
  product_name TEXT NOT NULL,
  feed_product_name TEXT,
  price REAL NOT NULL,
  currency TEXT DEFAULT 'GBP',
  stock_status TEXT,
  merchant_category TEXT,
  image_url TEXT,
  affiliate_url TEXT NOT NULL,
  ean TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  specs_json TEXT,
  product_slug TEXT
);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_category ON products(site_category);
CREATE INDEX idx_products_retailer ON products(retailer);
CREATE UNIQUE INDEX ux_products_refresh_stable_key ON products(retailer, merchant_product_id)
  WHERE merchant_product_id IS NOT NULL AND TRIM(merchant_product_id) <> '';

CREATE VIRTUAL TABLE products_fts USING fts5(
  product_name, brand, subcategory, retailer, merchant_category,
  content='products', content_rowid='id'
);
CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, product_name, brand, subcategory, retailer, merchant_category)
  VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer, new.merchant_category);
END;
CREATE TRIGGER products_fts_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, product_name, brand, subcategory, retailer, merchant_category)
  VALUES ('delete', old.id, old.product_name, old.brand, old.subcategory, old.retailer, old.merchant_category);
END;
CREATE TRIGGER products_fts_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, product_name, brand, subcategory, retailer, merchant_category)
  VALUES ('delete', old.id, old.product_name, old.brand, old.subcategory, old.retailer, old.merchant_category);
  INSERT INTO products_fts(rowid, product_name, brand, subcategory, retailer, merchant_category)
  VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer, new.merchant_category);
END;

CREATE TABLE affiliate_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  product_id INTEGER,
  awin_product_id TEXT,
  retailer TEXT,
  brand TEXT,
  site_category TEXT,
  product_name TEXT,
  page_path TEXT,
  language TEXT,
  display_currency TEXT,
  country_code TEXT,
  session_id TEXT,
  source TEXT DEFAULT 'retailer_click'
);
CREATE INDEX idx_affiliate_clicks_date ON affiliate_clicks(clicked_at);
CREATE INDEX idx_affiliate_clicks_product ON affiliate_clicks(product_id);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  country TEXT NOT NULL,
  trade TEXT,
  privacy_consent INTEGER NOT NULL DEFAULT 0,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
