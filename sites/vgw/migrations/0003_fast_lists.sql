-- Lessons L159 (15 Nov 2026): the lists of a big category read only the cards they show.
-- On 14 Nov 2026 Car Gear World got 92,535 tyres (one category of 123,142 rows) and its D1 answered "overloaded": every
-- category page numbered all the rows of its category, and the counts, the filters and the home page read every row.
-- With these indexes src/db.js (fastMode, FAST_INDEX_SQL: exactly these statements) walks each category in the order of
-- the page (featured, newest, below RRP, and the covering index for the counts and filters), so a page reads tens of
-- rows. Only indexes: no table and no row changes. Without them the code reads as before.
CREATE INDEX IF NOT EXISTS idx_products_cat_featured ON products (is_active, category_slug, in_stock DESC, ((id * 1103515245 + 12345) % 2147483647));
CREATE INDEX IF NOT EXISTS idx_products_cat_newest ON products (is_active, category_slug, first_seen_at);
CREATE INDEX IF NOT EXISTS idx_products_cat_saving ON products (is_active, category_slug, (CASE WHEN was_price > price THEN (was_price - price) / was_price ELSE 0 END) DESC);
CREATE INDEX IF NOT EXISTS idx_products_deals ON products (is_active, ((was_price - price) / was_price) DESC);
CREATE INDEX IF NOT EXISTS idx_products_cat_cover ON products (is_active, category_slug, retailer, last_seen_at, in_stock, brand, price, gtin);
