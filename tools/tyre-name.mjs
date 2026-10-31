// Tyre shops (Pneus.be, Awin 82533, 31 Oct 2026, lessons L87) name a tyre by its model only ("P Zero PZ4 LS"): the brand
// is in brand_name and the SIZE only in the shop's product address ("…/pirelli-p-zero-pz4-ls-225-40-r19-93y__9998526").
// Without the size, one model in 300 sizes would be 300 identical cards. tyreName() builds
// "Pirelli P Zero PZ4 LS 225/40 R19 93Y" from the three.
//
// Car tyres have a metric width that ends in 5 (155, 205, 225, 315); motorbike and scooter tyres one that ends in 0
// (110/70, 180/55) or a diagonal (D) build ("90/90 D21"). twoWheel tells them apart.

// "-225-40-r19-93y", "-235-35-zr19-91y", "-110-70-r17-54v", "-90-90-d21-54h", "-260-40-vr18-84v", "-205-55-r16-91w-xl"
const SLUG_SIZE = /-(\d{2,3})-(\d{2,3})-(zr|vr|wr|r|d|b)?-?(\d{2})(?:-5)?(?:-(\d{2,3}(?:-\d{2,3})?)([a-z]{1,2}))?(?=-|$)/i;

export function sizeFromLink(link) {
  let path = '';
  try { path = new URL(String(link || '')).pathname; } catch { return null; }
  const seg = decodeURIComponent(path.split('/').filter(Boolean).pop() || '').split('__')[0];
  const m = SLUG_SIZE.exec(seg);
  if (!m) return null;
  const width = Number(m[1]);
  const aspect = Number(m[2]);
  const cons = (m[3] || '').toUpperCase();
  const rim = Number(m[4]);
  if (width < 60 || width > 400 || aspect < 25 || aspect > 110 || rim < 8 || rim > 26) return null;
  const load = m[5] ? `${m[5].replace('-', '/')}${(m[6] || '').toUpperCase()}` : '';
  const text = `${width}/${aspect} ${cons || '-'}${rim}${load ? ' ' + load : ''}`.replace(' -', '-');
  return { width, aspect, cons, rim, load, text, twoWheel: width % 10 === 0 || cons === 'D' || cons === 'B' };
}

// MICHELIN -> Michelin, HANKOOK -> Hankook; mixed-case names (BF Goodrich, Continental) stay as they are.
export function brandName(brand) {
  const b = String(brand || '').trim();
  if (b.length > 3 && b === b.toUpperCase()) return b.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, s, c) => s + c.toUpperCase());
  return b;
}

export function tyreName(model, brand, link) {
  const m = String(model || '').trim();
  const b = brandName(brand);
  const size = sizeFromLink(link);
  const base = b && !m.toLowerCase().startsWith(b.toLowerCase()) ? `${b} ${m}` : m;
  return { name: size ? `${base} ${size.text}` : base, size };
}
