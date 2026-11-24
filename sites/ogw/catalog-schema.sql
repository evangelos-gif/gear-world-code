-- Mega Stores Gear World: the catalogue of the big stores of Linkwise (owner, 24 Nov 2026, lessons L228): all their
-- products, in their own categories, one store per page, never compared. Its own D1 database
-- ("mega-stores-gear-world-catalog"), never a database of the 13 sites, the Hub or the app. Loaded only by
-- tools/ogw-site.ps1 -Step catalog with the owner's phrase. No affiliate code or tracking link is stored: each product
-- keeps the store's own page, and the Worker makes the Linkwise link with the secret LINKWISE_CODE.
-- stores.picks: the prices of the store's own sets and gift ideas of sites/ogw/site.config.js ({"<priceKey>": euros}),
-- from the same feed, so they stay fresh with the catalogue. stores.loading = 1 while a load is under way (its first file
-- sets it, its last file clears it): the pages say "is being updated" instead of showing half a store.
CREATE TABLE IF NOT EXISTS stores (program INTEGER PRIMARY KEY, slug TEXT NOT NULL, checked_at TEXT NOT NULL, products INTEGER NOT NULL DEFAULT 0, loading INTEGER NOT NULL DEFAULT 0, picks TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS categories (program INTEGER NOT NULL, id INTEGER NOT NULL, parent INTEGER NOT NULL, level INTEGER NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL, products INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (program, id));
CREATE INDEX IF NOT EXISTS categories_parent ON categories (program, parent);
CREATE TABLE IF NOT EXISTS products (program INTEGER NOT NULL, pid TEXT NOT NULL, pos INTEGER NOT NULL, c1 INTEGER NOT NULL, c2 INTEGER NOT NULL, c3 INTEGER NOT NULL, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', page TEXT NOT NULL, image TEXT NOT NULL, price REAL NOT NULL, PRIMARY KEY (program, pid)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS products_c1 ON products (program, c1, pos);
CREATE INDEX IF NOT EXISTS products_c2 ON products (program, c2, pos);
CREATE INDEX IF NOT EXISTS products_c3 ON products (program, c3, pos);
