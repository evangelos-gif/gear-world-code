-- Lessons L206 (20 Nov 2026): more photos on the product page. One nullable column at the end of the products table: up
-- to 4 extra full-size https photo addresses of the product (never the main image_url), separated by one space
-- (src/lib/photos.js), NULL when there are none. SQLite writes no row for it (only the table's text in sqlite_master
-- changes), every INSERT of the import tools names its columns, and no index, view or trigger uses it. The sites read it
-- only after they have seen the column (src/db.js hasImagesColumn), so the code works the same before and after this.
-- In the live database by tools/d1-photo-column.ps1 (its approval phrase, a Time Travel restore point first).
-- A new database gets it with the other migrations ("wrangler d1 migrations apply"); on a database that has it already
-- that command stops here with "duplicate column name: images" and changes nothing.
ALTER TABLE products ADD COLUMN images TEXT;
