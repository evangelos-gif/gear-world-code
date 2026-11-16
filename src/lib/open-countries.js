// The open-country rule (owner, 12 and 14 Nov 2026, lessons L151).
//
// A country is OPEN when the network can serve it on its own: at least 30,000 fresh products that deliver there, from at
// least 4 retailers, and no retailer with more than half of them. The numbers are the Group page's (gearworldgroup.com,
// src/group.js: every site's /api/stats, per country, about every hour); a product counts in every country its retailer
// delivers to (src/lib/delivery.js).
//
// OPEN_COUNTRIES is the list the sites use, written here by hand: a country that meets the rule on the Group page is
// added only with the update of all the sites (tools/sites-update-all.ps1, «ΕΓΚΡΙΝΩ ALL UPDATES»), never by itself.
// Today the UK and Poland. Belgium waits: Pneus.be has 92% of what delivers there (14 Nov 2026).
// Poland (owner, 15 Nov 2026, lessons L157: "we can get round the rule, since it has so many different products and
// categories, open Poland"): opened before the rule, with AliExpress PL (about 28,000 different products in over 40
// categories, Polish names, prices in zloty). A retailer that delivers ONLY to open countries other than the UK
// (AliExpress PL) is seen only in their views, never in the all view (src/lib/visibility.js localOnlyRetailers), so a
// visitor from Germany or Greece does not get Polish names. A site where no retailer delivers to Poland gives a visitor
// from Poland the all view, not an empty page.
//   - An open country sees ONLY what delivers there (src/lib/visibility.js).
//   - Every other country sees ALL the products, each with "<retailer> delivers to ..." (src/pages/layout.js
//     deliveryLine), and the bar "We're adding retailers for your country ...". The United States keep the view of their
//     own of 14 Nov 2026 (lessons L141): what ships to the US. Google's crawlers keep the UK view (src/engine.js).
//   - Since 15 Nov 2026 (owner, lessons L165) "all" leaves out the shops that ship only to the US (seen only by visitors
//     from the US), and a feed in another language (deliversTo.languages) is seen only in the countries that speak it.
//     The Group counts such a feed only in those countries (src/lib/delivery.js shownCountries).
export const OPEN_COUNTRIES = ['GB', 'PL'];

export const OPEN_RULE = { products: 30000, retailers: 4, share: 0.5 };

// One country's numbers against the rule: { products, retailers, share, meets, missing: { products, retailers, share } }.
// c = { products, retailers, top } (top: the products of the retailer with the most). missing.products and
// missing.retailers: how many more are needed (0 = enough); missing.share: true while one retailer has more than half.
export function openCheck(c) {
  const num = v => Math.max(0, Math.floor(Number(v) || 0));
  const products = num(c && c.products);
  const retailers = num(c && c.retailers);
  const top = Math.min(products, num(c && c.top));
  const share = products ? top / products : 0;
  const missing = {
    products: Math.max(0, OPEN_RULE.products - products),
    retailers: Math.max(0, OPEN_RULE.retailers - retailers),
    share: products > 0 && share > OPEN_RULE.share
  };
  return { products, retailers, share, meets: products > 0 && !missing.products && !missing.retailers && !missing.share, missing };
}
