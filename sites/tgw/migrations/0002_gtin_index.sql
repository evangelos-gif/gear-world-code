-- Technology Gear World - index of the GTIN for the barcode search (lessons L115, 10 Nov 2026). Only an index: no table or
-- row changes. /api/products?gtin=<code> (the Gear World app's "Scan barcode", through the Hub's /api/barcode) finds the
-- rows of one GTIN through it instead of reading the whole table. TGW does not group offers, so it has no group-key index
-- (lessons L105): its lookup is on the gtin column itself (PLAIN_GTIN_KEY in src/db.js; the import keeps digits only).
-- The live database gets it from tools/d1-gtin-index.ps1 (ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ BARCODE); a new database from this migration.
CREATE INDEX IF NOT EXISTS idx_products_gtin ON products(gtin);
