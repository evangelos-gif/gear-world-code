import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { patchFooter, legalFiles, run, PAGES, HUB } from '../../tools/gwh-legal-pages.mjs';
import { hubIndexHtml, writeHubFixture } from '../fixtures/make-hub-fixture.mjs';

const FOOTER = [
  '  <footer>',
  '    <div class="container footer-inner">',
  '      <strong>Gear World Hub</strong>',
  '      <a href="mailto:contact@gearworldhub.com" class="footer-contact">contact@gearworldhub.com</a>',
  '      <span>&copy; <span id="year"></span> Gear World. All rights reserved.</span>',
  '    </div>',
  '  </footer>'
].join('\r\n');
const withFooter = html => html.replace('</body>', FOOTER + '\r\n</body>');

test('footer: the 5 legal links are added once, after the copyright line, keeping CRLF', () => {
  const r = patchFooter(withFooter(hubIndexHtml()));
  assert.equal(r.already, false);
  for (const p of PAGES) assert.equal(r.text.split(`href="/${p.slug}/"`).length - 1, 1, p.slug);
  assert.ok(r.text.indexOf('footer-legal') > r.text.indexOf('All rights reserved.'));
  assert.ok(r.text.indexOf('footer-legal') < r.text.indexOf('</footer>'));
  assert.ok(r.text.includes('</span>\r\n      <!-- GWH-LEGAL-LINKS -->\r\n'));
  assert.equal(patchFooter(r.text).already, true, 'second run changes nothing');
});

test('footer: an unexpected footer changes nothing', () => {
  assert.throws(() => patchFooter(hubIndexHtml()), /copyright line once, found it 0/);
  const twice = withFooter(hubIndexHtml()).replace('</body>', '<span>&copy; <span id="year"></span> Gear World. All rights reserved.</span></body>');
  assert.throws(() => patchFooter(twice), /found it 2/);
});

test('pages: 5 pages + css + js, each page complete and only about the hub (L01, L17)', () => {
  const files = legalFiles();
  assert.deepEqual(Object.keys(files).sort(), ['affiliate-disclosure/index.html', 'contact/index.html', 'cookies/index.html',
    'legal/legal.css', 'legal/legal.js', 'privacy/index.html', 'terms/index.html']);
  for (const p of PAGES) {
    const h = files[`${p.slug}/index.html`];
    assert.ok(h.startsWith('<!doctype html>'), p.slug);
    assert.ok(h.includes('<meta charset="utf-8">'));
    assert.ok(h.includes(`<link rel="canonical" href="https://${HUB.domain}/${p.slug}/">`));
    assert.equal((h.match(/<h1>/g) || []).length, 1);
    for (const q of PAGES) assert.ok(h.includes(`href="/${q.slug}/"`), `${p.slug} links to ${q.slug}`);
    assert.ok(h.includes(HUB.email), `${p.slug} has the contact email`);
    assert.doesNotMatch(h, /\b(CGW|MGW|WGW|KGW|HGW|GGW|TGW|AGW|VGW)\b|Technology Gear World|Home Gear/, 'no other site names');
    assert.doesNotMatch(h, /<style|onclick=|javascript:/i, 'no inline style or script');
  }
  const privacy = files['privacy/index.html'];
  for (const s of ['Google Analytics', 'Cloudflare', 'Newsletter', 'Voice search', 'ico.org.uk', 'Awin']) assert.ok(privacy.includes(s), s);
  assert.ok(files['cookies/index.html'].includes('gwh_analytics_consent') && files['cookies/index.html'].includes('id="gwhAnalyticsReset"'));
  assert.ok(files['legal/legal.js'].includes('"gwh_analytics_consent"'));
  assert.doesNotThrow(() => new Function(files['legal/legal.js']));
});

test('run: plan changes nothing, write adds everything, second run is already done', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gwh-legal-'));
  writeHubFixture(dir);
  const indexPath = join(dir, 'public', 'index.html');
  writeFileSync(indexPath, withFooter(readFileSync(indexPath, 'utf8')));
  const before = readFileSync(indexPath, 'utf8');
  const plan = run(dir, false);
  assert.equal(plan.already, false);
  assert.equal(plan.changes.length, 8);
  assert.equal(readFileSync(indexPath, 'utf8'), before);
  assert.equal(existsSync(join(dir, 'public', 'privacy')), false);
  run(dir, true);
  assert.ok(readFileSync(indexPath, 'utf8').includes('GWH-LEGAL-LINKS'));
  for (const rel of Object.keys(legalFiles())) assert.ok(existsSync(join(dir, 'public', ...rel.split('/'))), rel);
  assert.equal(run(dir, false).already, true);
  // an older version of a page is updated, not duplicated
  writeFileSync(join(dir, 'public', 'terms', 'index.html'), 'old');
  const again = run(dir, false);
  assert.equal(again.already, false);
  assert.deepEqual(again.existing, ['terms/index.html']);
});
