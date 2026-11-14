// Clean-up rule "nolink" (owner, 6 Nov 2026, lessons L96): Juicy Couture UK on KGW (43) and HGW (1) had Awin links with
// no product page after "ued=", so "Buy" opened the shop's home page. Links as they were in the KGW database on 4 Nov 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as nolink from '../../tools/cleanup-rules/nolink.mjs';

test('L96: nolink hides only Awin links without a product page, names the shop, and the rollback shows them again', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, retailer TEXT, site_category TEXT, product_name TEXT,
    affiliate_url TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT)`);
  const add = db.prepare('INSERT INTO products (retailer, site_category, product_name, affiliate_url, is_active) VALUES (?, ?, ?, ?, ?)');
  add.run('Juicy Couture UK', 'Bags', 'Juicy Couture Kids Mini Tote', 'https://www.awin1.com/cread.php?awinmid=19471&awinaffid=3057233&ued=%26utm_source%3Daw%26utm_medium%3DAffiliates', 1);
  add.run('Juicy Couture UK', 'Bags', 'No ued at all', 'https://www.awin1.com/cread.php?awinmid=19471&awinaffid=3057233&clickref=kgw-2', 1);
  add.run('Back to the Office', 'Kids Tech', 'Belkin Wireless On-Ear Headphones for Kids', 'https://www.awin1.com/cread.php?awinmid=61655&awinaffid=3057233&ued=https%3A%2F%2Fwww.backtotheoffice.co.uk%2Fproducts%2Fbelkin', 1);
  add.run('Stan Ray UK', 'Clothing', 'Product-level Awin link', 'https://www.awin1.com/pclick.php?p=45361361001&a=3057233&m=128533', 1);
  add.run('XPLORA UK', 'Kids Tech', 'CJ link', 'https://www.anrdoezrs.net/click-101917444-15734567?url=https%3A%2F%2Fxplora.co.uk%2Fproducts%2Fx6play', 1);
  add.run('My Tool Shed', 'Garden Tools', 'Plain shop link', 'https://www.mytoolshed.co.uk/products/spade', 1);
  add.run('Juicy Couture UK', 'Bags', 'Already hidden', 'https://www.awin1.com/cread.php?awinmid=19471&awinaffid=3057233&ued=', 0);
  for (const f of ['summarySql', 'samplesSql', 'idsSql', 'keptSql']) assert.doesNotMatch(nolink[f](), /[%<>&|^]/, f);
  const ids = db.prepare(nolink.idsSql()).all().map(r => r.id);
  assert.deepEqual(ids, [1, 2]);
  assert.deepEqual(db.prepare(nolink.summarySql()).all().map(r => `${r.reason} | ${r.site_category} | ${r.n}`),
    ['Juicy Couture UK: Awin link without a product page | Bags | 2']);
  db.exec(nolink.updateSql(ids, false));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').get().n, 4);
  assert.deepEqual(db.prepare(nolink.idsSql()).all(), [], 'nothing left after the clean-up');
  db.exec(nolink.updateSql(ids, true));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').get().n, 6);
});
