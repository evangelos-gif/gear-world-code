-- Gaming Gear World - index of the product-group key (lessons L105, 8 Nov 2026). Only an index: no table or row changes.
-- "The same product at other retailers" and the cards of "similar products" find the rows of a product group through
-- it, instead of reading the whole table or category on every product page. The expression is exactly the text of
-- NATIVE_GROUP_KEY in src/db.js (SQLite uses an index on an expression only for the same expression).
-- Live databases get it from tools/d1-native-index.ps1 (ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ D1); new databases from this migration.
CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(COALESCE(NULLIF(TRIM(gtin), ''), 'id:' || id));
