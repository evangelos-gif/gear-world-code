// Import rules for Uhrcenter (Awin advertiser 15039, uhrcenter.de, euros): watches and jewellery on Women's and Men's
// Gear World (massive import round 2c, 14 Nov 2026, lessons L144). Feed facts (feed 34901, 9,366 rows): every row in
// stock, German names ("Boccia 3386-02 Titan-Damenuhr Quarz mit Saphirglas 10 bar"), the shop's path in
// merchant_product_category_path ("Uhren>Boccia>Damenuhren", "Schmuck>trendor>Ringe", "Großuhren>...>Wecker").
// Delivery (uhrcenter.de "Lieferung ins Ausland", read 14 Nov 2026): Germany and about 60 countries, the UK included, not
// the United States. The names are German, so the site configs show the shop only where German is spoken (Germany,
// Austria, Switzerland, Liechtenstein, Luxembourg), never in the UK view (deliversTo, lessons L107).
//  - watches: "Herren" or the shop's "Herrenuhren" -> MGW Men's Watches, "Damen" or "Damenuhren" -> WGW Watches, others
//    (Casio, Luminox, Junghans max bill ...) -> MGW Unisex Watches; watch straps, clocks and alarm clocks are left out;
//  - jewellery: for men ("Herren", "für Männer") -> MGW Men's Jewellery, otherwise WGW Women's Jewellery;
//  - children's pieces (Kinder, Baby, Mädchen, Jungen), lighters and other accessories are left out; men's belts -> MGW Belts.
export const RULES = {
  key: 'uhrcenter',
  advertiserId: 15039,
  retailer: 'Uhrcenter',
  currency: 'EUR',
  shop: /^https:\/\/(www\.)?uhrcenter\.de\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 6000,
  minPrice: 10
};

// One card per shop page: the ring sizes are options of it ("183100444V7" ... "V12" share the page).
export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').replace(/V\d+$/i, '').trim();
}

// The shop's path goes to the rules through the Awin category (it is not stored on the site).
export function field(c, column) {
  if (c === 'category_name') return column('merchant_product_category_path') || column('category_name');
  return column(c);
}

const W = list => new RegExp('(?<![\\p{L}\\d])(?:' + list.join('|') + ')', 'iu');
const KIDS = W(['kinder', 'baby', 'babys', 'mädchen', 'jungen', 'taufe', 'schulanfang']);
const MEN = W(['herren', 'männer', 'mann\\b', 'für ihn']);
const WOMEN = W(['damen', 'frauen', 'für sie']);

export function classify({ name, awinCategory = '' }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  const path = String(awinCategory || '');
  const top = path.split('>')[0].trim().toLowerCase();
  const leaf = (path.split('>').pop() || '').trim().toLowerCase();
  if (!n) return { reject: 'no name' };
  if (KIDS.test(n) || /kinder/i.test(path)) return { reject: "children's watch or jewellery (not on these sites)" };
  if (/gutschein|geschenkbox|reinigung|pflege|ersatz|batterie/i.test(n)) return { reject: 'voucher, box, care or spare item' };
  const men = MEN.test(n) && !WOMEN.test(n);
  const women = WOMEN.test(n) && !MEN.test(n);
  if (top === 'uhren') {
    if (/uhrenarmb(ä|ae)nder|armband für uhren/i.test(leaf) || /\buhrenarmband\b/i.test(n)) return { reject: 'watch strap' };
    if (men || leaf === 'herrenuhren') return { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches" };
    if (women || leaf === 'damenuhren') return { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches' };
    return { site: 'mgw', siteCategory: 'Watches', subcategory: 'Unisex Watches' };
  }
  if (top === 'schmuck') {
    // The shop's folder first; a folder that says nothing ("Gravurschmuck", a brand's own) leaves it to the name
    // ("Thomas Sabo ... Damenring", "Gravur-Armband für Männer").
    const kind = t => /ohrring|ohrstecker|creole/.test(t) ? 'Earrings'
      : /ring(e)?\b|ring$|ringe$|ring /.test(t) ? 'Rings'
        : /armb(a|ä|ae)nd|armschmuck|armreif|fußkette/.test(t) ? 'Bracelets'
          : /halskette|halsschmuck|anh(ä|ae)nger|collier|kette/.test(t) && !/charm/.test(t) ? 'Necklaces' : '';
    const sub = kind(leaf) || kind(n.toLowerCase()) || 'Jewellery';
    if (men) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: sub === 'Rings' || sub === 'Earrings' ? 'Jewellery' : sub };
    return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: sub };
  }
  if (top === 'accessoires' && /gürtel/i.test(leaf) && men) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Belts' };
  return { reject: `not watches or jewellery (${top || 'no section'})` };
}
