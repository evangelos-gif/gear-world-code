-- Lessons L206: extra photos for the products of a local CI database (after the column migration), so the QA gate, the
-- layout and language checks and tools/gallery-check.mjs see the photo gallery of a product page. Never for a real
-- database. images.example is not on the internet: tools/gallery-check.mjs answers "-ok-" photos itself and makes
-- "-fail-" ones fail, so the gallery's "a photo that does not load is taken out" is tested too.
UPDATE products SET images = 'https://images.example/gw-ok-2.png https://images.example/gw-fail-3.png https://images.example/gw-ok-4.png' WHERE is_active = 1;
