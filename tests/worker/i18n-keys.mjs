// The texts the site script (assets/site.js, translateTree) would look up in a dictionary for a page, read from the
// server HTML in the same way: text nodes with letters, the data-i18n keys, and the placeholder, aria-label and title
// attributes, skipping <script>, <style>, <noscript>, <svg> and everything inside translate="no".
// Used by the tests to prove that every text of a page is in every dictionary (lessons L24).

const LETTERS = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
const ATTRS = ['placeholder', 'aria-label', 'title'];
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'use', 'path']);
const SKIP = new Set(['script', 'style', 'noscript', 'svg']);

const decode = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  // Named symbols (&rarr;, &copy;...) are not letters for the site script: they are dropped here.
  .replace(/&(?!amp;)[a-z]+;/gi, ' ').replace(/&amp;/g, '&');

function attrsOf(text) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(text))) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

export function translatableTexts(html) {
  const start = html.indexOf('<body');
  const src = start >= 0 ? html.slice(start) : html;
  const keys = new Set();
  const stack = [];
  const blocked = () => stack.some(e => e.block);
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[4] !== undefined) {
      if (blocked()) continue;
      const text = decode(m[4]).trim();
      if (text && LETTERS.test(text)) keys.add(text);
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const a = attrsOf(m[3] || '');
    const selfClosing = /\/\s*$/.test(m[3] || '') || VOID.has(tag);
    const block = SKIP.has(tag) || a.translate === 'no' || 'data-i18n' in a || 'data-country' in a || (tag === 'time' && 'datetime' in a);
    if (!blocked() && a.translate !== 'no' && !SKIP.has(tag)) {
      for (const k of ATTRS) if (a[k] && LETTERS.test(a[k])) keys.add(a[k].trim());
      if ('data-i18n' in a) keys.add(a['data-i18n']);
    }
    if (!selfClosing) stack.push({ tag, block });
  }
  return keys;
}
