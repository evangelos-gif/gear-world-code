#!/usr/bin/env node
// Gear World Hub sitemap (Worker gwh-sitemap): the exact sitemap.xml that the live version (before-worker.js) and the
// new version (worker.js) send, so tools/gwh-sitemap.ps1 can tell which one runs live. READ-ONLY, nothing goes online.
// Usage: node tools/gwh-sitemap.mjs sha before|new     prints the sha256 of that version's sitemap.xml
//        node tools/gwh-sitemap.mjs body before|new    prints the sitemap.xml itself
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const FILES = { before: '../sites/gwh-sitemap/before-worker.js', new: '../sites/gwh-sitemap/worker.js' };

export async function sitemapBody(which) {
  if (!FILES[which]) throw new Error('before or new');
  const mod = await import(new URL(FILES[which], import.meta.url).href);
  const res = await mod.default.fetch(new Request('https://gearworldhub.com/sitemap.xml'));
  return await res.text();
}

export const sha256 = text => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [what, which] = process.argv.slice(2);
  const body = await sitemapBody(which);
  process.stdout.write(what === 'sha' ? sha256(body) + '\n' : body);
}
