-- Lessons L193 (18 Nov 2026): the lists of a big category read only the cards they show, on the older database layout too.
-- CGW, MGW, WGW, KGW, HGW and GGW read every row of the category on every list page (CGW Hand Tools: 41,509), so their
-- imports stayed under 20,000 per category. With these indexes src/db.js (fastMode, LEGACY_FAST_INDEX_SQL: exactly these
-- statements) walks each category in the order of the page, finds the other offers of each card through the group key (CGW:
-- product_group_offers), and counts, filters and the home page come from the covering index. The first four are the L51
-- indexes and the plain category index CGW already has (IF NOT EXISTS: nothing is written for one that is there).
-- Only indexes: no table and no row changes (L28). Put in the live database by tools/d1-fast-lists.ps1 (with its approval
-- phrase), never by "wrangler d1 migrations apply". Without them, or after a DROP INDEX, the code reads exactly as before.
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products (is_active, site_category);
CREATE INDEX IF NOT EXISTS idx_products_active_category_price_id ON products (is_active, site_category, price, id);
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products (is_active, created_at);
CREATE INDEX IF NOT EXISTS idx_products_group_key ON products (COALESCE(NULLIF(TRIM(COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin'))), ''), 'id:' || id));
CREATE INDEX IF NOT EXISTS idx_products_old_featured ON products (is_active, site_category, (CASE WHEN LOWER(TRIM(COALESCE(stock_status, ''))) IN ('in_stock', 'in stock', '1', 'true', 'yes', 'available to order') THEN 1 ELSE 0 END) DESC, ((id * 1103515245 + 12345) % 2147483647));
CREATE INDEX IF NOT EXISTS idx_products_old_newest ON products (is_active, site_category, created_at);
CREATE INDEX IF NOT EXISTS idx_products_old_cover ON products (is_active, site_category, retailer, updated_at, (CASE WHEN LOWER(TRIM(COALESCE(stock_status, ''))) IN ('in_stock', 'in stock', '1', 'true', 'yes', 'available to order') THEN 1 ELSE 0 END), brand, price, (COALESCE(NULLIF(TRIM(COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin'))), ''), 'id:' || id)));
