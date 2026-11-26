// Priority A of the sheet «Λείπουν 25-11» (chat 7, 25 Nov 2026, lessons L234): approved shops that are not on the 13
// sites yet and sell to Germany, Austria, the Netherlands, Belgium, Ireland, Poland, the US or the EU. chat 3 says which
// of them have a feed, the countries of each shop's own delivery page and the language of its feed; this file holds
// the delivery line of each one (deliversTo.retailers and deliversTo.languages, lessons L62, L165), and the site
// configs (sites/<code>/site.config.js) spread waveDelivery(code) into their deliversTo, next to bol.com and Linkwise.
//
// The order never changes (L165, L194): FIRST this line live with ALL UPDATES, THEN the import. A shop imported without
// its line falls under the site's default (the UK) and would be listed in the UK view, to Google and in the sitemaps.
//
// One entry per shop and site:
//   { site: 'hgw', retailer: 'Kochblume DE', countries: ['DE'], language: 'de', row: 62, source: 'chat 3, 26 Nov 2026' }
// - retailer: exactly the name the import writes (its rules file or sources.json), which the cards show. On the six
//   older sites (CGW GGW HGW KGW MGW WGW) only [A-Za-z0-9 .-] (tools/legacy-import.ps1).
// - countries: from the shop's own delivery page (chat 3), never guessed, never GB or WORLD (Priority A is outside the UK).
//   A shop may be shown in fewer countries than it delivers to, never in more: where a country would make a new page
//   group (at most 10 a site, L199, L202), it is left out, as Baobab Collection (France only) and bol.com on HGW (the
//   Netherlands only) are.
// - language: the feed's language when it is not English ('de', 'nl', 'fr', 'pl' ..., src/lib/delivery.js
//   FEED_LANGUAGES): the shop is then seen only in its countries that speak it. No language = English names, shown in the
//   all view of every country with "<shop> delivers to ...", except a shop of the US only (the US view, L165).
// - row: the row of «Λείπουν 25-11»; source: who gave the facts and when.
// No line for a shop that is not going to be imported (tests/worker/wave-a.test.mjs).

export const WAVE_A_SITES = Object.freeze(['agw', 'bgw', 'cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'pgw', 'sgw', 'tgw', 'vgw', 'wgw', 'zgw']);
// The older sites, whose import (tools/legacy-import.ps1) accepts only these letters in a shop's name.
export const LEGACY_SITES = Object.freeze(['cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'wgw']);
export const LEGACY_NAME = /^[A-Za-z0-9 .-]{2,40}$/;

// chat 3's list (tools/massive/wave-a-1126.json, 26 Nov 2026): 131 shops «ΝΑΙ». Countries from the feed (the Awin
// programme region, the countries of a Daisycon feed's products, the currency of a CJ or Rakuten feed; rows 7, 12 and 47
// also from the shop's delivery page), so never more than where it sells. Left out on the owner's decision (26 Nov 2026,
// «να περιμένουν»): the five HGW shops of Austria or Belgium alone (rows 40, 52, 73, 78, 80), which would make HGW's
// 11th to 13th page group. Left out by chat 4 for the same reason (L199): on WGW Vanilla Copenhagen DK (row 228,
// Danish) and ZadigandVoltaire FR (row 230, French) would make the 11th and 12th group; both sell outside the Priority A
// countries.
const SRC = 'chat 3, 26 Nov 2026 (tools/massive/wave-a-1126.json)';

export const WAVE_A = Object.freeze([
  // AGW
  { site: 'agw', retailer: 'AstroAI US', countries: ['US'], row: 4, source: SRC },
  { site: 'agw', retailer: 'Eonon US', countries: ['US'], row: 5, source: SRC },
  { site: 'agw', retailer: 'Fussmatten-Welt DE', countries: ['DE'], language: 'de', row: 6, source: SRC },
  { site: 'agw', retailer: 'Lectron US', countries: ['US'], row: 7, source: SRC },
  { site: 'agw', retailer: 'Rexing US', countries: ['US'], row: 11, source: SRC },
  { site: 'agw', retailer: 'SEALIGHT US', countries: ['US'], row: 12, source: SRC },
  // CGW
  { site: 'cgw', retailer: 'Gereedschapspecialist NL', countries: ['NL'], language: 'nl', row: 18, source: SRC },
  { site: 'cgw', retailer: 'ssimder welding equipment inc US', countries: ['US'], row: 19, source: SRC },
  // GGW
  { site: 'ggw', retailer: 'InterGard Heim und Garten DE', countries: ['DE'], language: 'de', row: 31, source: SRC },
  { site: 'ggw', retailer: 'Orchideen Klusmann DE', countries: ['DE'], language: 'de', row: 33, source: SRC },
  { site: 'ggw', retailer: 'Rasendoktor DE', countries: ['DE'], language: 'de', row: 34, source: SRC },
  { site: 'ggw', retailer: 'WILDGUARDER US', countries: ['US'], row: 37, source: SRC },
  // HGW
  { site: 'hgw', retailer: '1-800Lighting US', countries: ['US'], row: 38, source: SRC },
  { site: 'hgw', retailer: 'ARIEL Bath US', countries: ['US'], row: 39, source: SRC },
  { site: 'hgw', retailer: 'Bioethanol-Kamin-Shop DE', countries: ['DE'], language: 'de', row: 41, source: SRC },
  { site: 'hgw', retailer: 'Bioethanolhaard-Shop NL', countries: ['NL'], language: 'nl', row: 42, source: SRC },
  { site: 'hgw', retailer: 'Biokominek-Shop PL', countries: ['PL'], language: 'pl', row: 43, source: SRC },
  { site: 'hgw', retailer: 'COSORI DE', countries: ['DE'], language: 'de', row: 46, source: SRC },
  { site: 'hgw', retailer: 'CUCKOO Electronics America', countries: ['US', 'CA', 'MX'], row: 47, source: SRC },
  { site: 'hgw', retailer: 'Dekotopia DE', countries: ['DE'], language: 'de', row: 49, source: SRC },
  { site: 'hgw', retailer: 'DirectWonen.nl NL', countries: ['NL'], language: 'nl', row: 50, source: SRC },
  { site: 'hgw', retailer: 'Enjoy The Wood US', countries: ['US'], row: 51, source: SRC },
  { site: 'hgw', retailer: 'FUFUandGAGA US', countries: ['US'], row: 54, source: SRC },
  { site: 'hgw', retailer: 'HOMELEADER INC US', countries: ['US'], row: 57, source: SRC },
  { site: 'hgw', retailer: 'HOMSEE US', countries: ['US'], row: 58, source: SRC },
  { site: 'hgw', retailer: 'House of Lamps US', countries: ['US'], row: 59, source: SRC },
  { site: 'hgw', retailer: 'Janine DE', countries: ['DE'], language: 'de', row: 60, source: SRC },
  { site: 'hgw', retailer: 'Kochblume DE', countries: ['DE'], language: 'de', row: 62, source: SRC },
  { site: 'hgw', retailer: 'LampenConcurrent NL', countries: ['NL'], language: 'nl', row: 63, source: SRC },
  { site: 'hgw', retailer: 'LEDLager DE', countries: ['DE'], language: 'de', row: 64, source: SRC },
  { site: 'hgw', retailer: 'Leuchtmittel Verkauf DE', countries: ['DE'], language: 'de', row: 65, source: SRC },
  { site: 'hgw', retailer: 'Levoit DE', countries: ['DE'], language: 'de', row: 66, source: SRC },
  { site: 'hgw', retailer: 'Matten Welt DE', countries: ['DE'], language: 'de', row: 69, source: SRC },
  { site: 'hgw', retailer: 'Maytag US', countries: ['US'], row: 70, source: SRC },
  { site: 'hgw', retailer: 'meubelo.nl NL', countries: ['NL'], language: 'nl', row: 71, source: SRC },
  { site: 'hgw', retailer: 'moebel.de DE', countries: ['DE'], language: 'de', row: 72, source: SRC },
  { site: 'hgw', retailer: 'NORMA24 DE', countries: ['DE'], language: 'de', row: 74, source: SRC },
  { site: 'hgw', retailer: 'Profichemie.com DE', countries: ['DE'], language: 'de', row: 75, source: SRC },
  { site: 'hgw', retailer: 'Puredown.Inc US', countries: ['US'], row: 77, source: SRC },
  { site: 'hgw', retailer: 'Sanifun - Online-sanitairkopen.nl NL', countries: ['NL'], language: 'nl', row: 79, source: SRC },
  { site: 'hgw', retailer: 'sheepworld DE', countries: ['DE'], language: 'de', row: 82, source: SRC },
  { site: 'hgw', retailer: 'Silicon Valley Air Expert Inc US', countries: ['US'], row: 83, source: SRC },
  { site: 'hgw', retailer: 'Vincasa DE', countries: ['DE'], language: 'de', row: 86, source: SRC },
  { site: 'hgw', retailer: 'Whirlpool USA', countries: ['US'], row: 89, source: SRC },
  { site: 'hgw', retailer: 'YouCustomizeIt US', countries: ['US'], row: 90, source: SRC },
  // KGW
  { site: 'kgw', retailer: 'Baker Ross IE', countries: ['IE'], row: 91, source: SRC },
  { site: 'kgw', retailer: 'Goally US', countries: ['US'], row: 93, source: SRC },
  { site: 'kgw', retailer: 'Mein kleines Baby DE', countries: ['DE'], language: 'de', row: 97, source: SRC },
  { site: 'kgw', retailer: 'Mijn Hummeltje NL', countries: ['NL'], language: 'nl', row: 99, source: SRC },
  { site: 'kgw', retailer: 'Spelhuis BE', countries: ['BE'], language: 'nl', row: 103, source: SRC },
  { site: 'kgw', retailer: 'Tushbaby US', countries: ['US'], row: 105, source: SRC },
  { site: 'kgw', retailer: 'Zulily US', countries: ['US'], row: 106, source: SRC },
  { site: 'kgw', retailer: 'Modellbau-Universe DE', countries: ['DE'], language: 'de', row: 107, source: SRC },
  // MGW
  { site: 'mgw', retailer: 'Bamboo Basics BE', countries: ['BE'], language: 'nl', row: 108, source: SRC },
  { site: 'mgw', retailer: 'Bruno Marc US', countries: ['US'], row: 109, source: SRC },
  { site: 'mgw', retailer: 'ECKO UNLTD US', countries: ['US'], row: 111, source: SRC },
  { site: 'mgw', retailer: 'EFE Glasses US', countries: ['US'], row: 112, source: SRC },
  { site: 'mgw', retailer: 'Hanes.com US', countries: ['US'], row: 114, source: SRC },
  { site: 'mgw', retailer: 'Sebastian Cruz Couture US', countries: ['US'], row: 116, source: SRC },
  { site: 'mgw', retailer: 'Shoes4Gentlemen DE', countries: ['DE'], language: 'de', row: 117, source: SRC },
  { site: 'mgw', retailer: 'Timeshop24 DE', countries: ['DE'], language: 'de', row: 119, source: SRC },
  { site: 'mgw', retailer: 'Van Arendonk BE', countries: ['BE'], language: 'nl', row: 121, source: SRC },
  { site: 'mgw', retailer: 'Van Arendonk NL', countries: ['NL'], language: 'nl', row: 122, source: SRC },
  // PGW
  { site: 'pgw', retailer: 'Dowinx US', countries: ['US'], row: 22, source: SRC },
  { site: 'pgw', retailer: 'Kelz0r DK', countries: ['DK'], language: 'da', row: 24, source: SRC },
  { site: 'pgw', retailer: 'Ubisoft DE', countries: ['DE'], language: 'de', row: 27, source: SRC },
  { site: 'pgw', retailer: 'Ubisoft NL', countries: ['NL'], language: 'nl', row: 29, source: SRC },
  // SGW
  { site: 'sgw', retailer: '365Rider DE', countries: ['DE'], language: 'de', row: 131, source: SRC },
  { site: 'sgw', retailer: 'Anta Sports America US', countries: ['US'], row: 134, source: SRC },
  { site: 'sgw', retailer: 'Donnay.nl NL', countries: ['NL'], language: 'nl', row: 135, source: SRC },
  { site: 'sgw', retailer: 'House of Scuba US', countries: ['US'], row: 138, source: SRC },
  { site: 'sgw', retailer: 'leguano DE', countries: ['DE'], language: 'de', row: 139, source: SRC },
  { site: 'sgw', retailer: 'Merrell PL', countries: ['PL'], language: 'pl', row: 140, source: SRC },
  { site: 'sgw', retailer: 'OpticsPlanet Dvor US', countries: ['US'], row: 142, source: SRC },
  { site: 'sgw', retailer: 'Shokz DE', countries: ['DE'], language: 'de', row: 145, source: SRC },
  { site: 'sgw', retailer: 'Sinner NL', countries: ['NL'], language: 'nl', row: 146, source: SRC },
  { site: 'sgw', retailer: 'Topoutdoorshop.nl NL', countries: ['NL'], language: 'nl', row: 147, source: SRC },
  { site: 'sgw', retailer: 'Topsnowshop.nl NL', countries: ['NL'], language: 'nl', row: 148, source: SRC },
  { site: 'sgw', retailer: 'Trail DE', countries: ['DE'], language: 'de', row: 150, source: SRC },
  { site: 'sgw', retailer: 'TT Shop Tischtennis Equipment DE', countries: ['DE'], language: 'de', row: 151, source: SRC },
  { site: 'sgw', retailer: 'Voetbaltafel.nl Tafeltennistafel.nl NL', countries: ['NL'], language: 'nl', row: 152, source: SRC },
  { site: 'sgw', retailer: 'Zwemshop.com BE', countries: ['BE'], language: 'nl', row: 153, source: SRC },
  // TGW
  { site: 'tgw', retailer: 'Acculaders.nl NL', countries: ['NL'], language: 'nl', row: 154, source: SRC },
  { site: 'tgw', retailer: 'Akku.net DE', countries: ['DE'], language: 'de', row: 156, source: SRC },
  { site: 'tgw', retailer: 'Aurzen US', countries: ['US'], row: 159, source: SRC },
  { site: 'tgw', retailer: 'BlazeVideo DE', countries: ['DE'], language: 'de', row: 160, source: SRC },
  { site: 'tgw', retailer: 'BLUETTI US', countries: ['US'], row: 161, source: SRC },
  { site: 'tgw', retailer: 'Coolblue NL', countries: ['NL'], language: 'nl', row: 163, source: SRC },
  { site: 'tgw', retailer: 'EcoFlow US', countries: ['US'], row: 165, source: SRC },
  { site: 'tgw', retailer: 'HIFI-REGLER DE', countries: ['DE'], language: 'de', row: 171, source: SRC },
  { site: 'tgw', retailer: 'hm-sat.de DE', countries: ['DE'], language: 'de', row: 172, source: SRC },
  { site: 'tgw', retailer: 'iRepairshop BE', countries: ['BE'], language: 'nl', row: 173, source: SRC },
  { site: 'tgw', retailer: 'MUNBYN LLC US', countries: ['US'], row: 176, source: SRC },
  { site: 'tgw', retailer: 'NIIMBOTS US', countries: ['US'], row: 177, source: SRC },
  { site: 'tgw', retailer: 'Paradigit.ie IE', countries: ['IE'], row: 180, source: SRC },
  { site: 'tgw', retailer: 'Plaud DE', countries: ['DE'], row: 182, source: SRC },
  { site: 'tgw', retailer: 'Quadcopter-shop NL', countries: ['NL'], language: 'nl', row: 183, source: SRC },
  { site: 'tgw', retailer: 'Systemtreff DE', countries: ['DE'], language: 'de', row: 186, source: SRC },
  { site: 'tgw', retailer: 'Teufel NL', countries: ['NL'], language: 'nl', row: 189, source: SRC },
  { site: 'tgw', retailer: 'TroniTechnik DE', countries: ['DE'], language: 'de', row: 190, source: SRC },
  // VGW
  { site: 'vgw', retailer: 'Koffer.de DE', countries: ['DE'], language: 'de', row: 193, source: SRC },
  // WGW
  { site: 'wgw', retailer: 'AMIclubwear US', countries: ['US'], row: 196, source: SRC },
  { site: 'wgw', retailer: 'Avocadostore DE', countries: ['DE'], language: 'de', row: 199, source: SRC },
  { site: 'wgw', retailer: 'Bali Bras US', countries: ['US'], row: 200, source: SRC },
  { site: 'wgw', retailer: 'BrillenPlatz DE', countries: ['DE'], language: 'de', row: 202, source: SRC },
  { site: 'wgw', retailer: 'Cashmere Boutique US', countries: ['US'], row: 204, source: SRC },
  { site: 'wgw', retailer: 'Caudalie USA', countries: ['CA', 'US'], row: 205, source: SRC },
  { site: 'wgw', retailer: 'FragranceNet.com US', countries: ['US'], row: 207, source: SRC },
  { site: 'wgw', retailer: 'Giuseppe Zanotti US', countries: ['US'], row: 210, source: SRC },
  { site: 'wgw', retailer: 'Goettgen.de DE', countries: ['DE'], language: 'de', row: 211, source: SRC },
  { site: 'wgw', retailer: 'iEDM US', countries: ['US'], row: 212, source: SRC },
  { site: 'wgw', retailer: 'Julep US', countries: ['US'], row: 213, source: SRC },
  { site: 'wgw', retailer: 'Maidenform US', countries: ['US'], row: 215, source: SRC },
  { site: 'wgw', retailer: 'MicroPerfumes.com US', countries: ['US'], row: 216, source: SRC },
  { site: 'wgw', retailer: 'Naghedi US', countries: ['US'], row: 218, source: SRC },
  { site: 'wgw', retailer: 'onehanesplace.com US', countries: ['US'], row: 219, source: SRC },
  { site: 'wgw', retailer: 'Princess Polly US', countries: ['US'], row: 220, source: SRC },
  { site: 'wgw', retailer: 'Robell DE', countries: ['DE'], language: 'de', row: 221, source: SRC },
  { site: 'wgw', retailer: 'Sachin and Babi US', countries: ['US'], row: 223, source: SRC },
  { site: 'wgw', retailer: 'Salontopper.nl NL', countries: ['NL'], language: 'nl', row: 224, source: SRC },
  { site: 'wgw', retailer: 'Stilettoschuhe.com DE', countries: ['DE'], language: 'de', row: 225, source: SRC },
  // ZGW
  { site: 'zgw', retailer: 'MaJa Koi NL', countries: ['NL'], language: 'nl', row: 126, source: SRC },
  { site: 'zgw', retailer: 'Plein.be BE', countries: ['BE'], language: 'nl', row: 128, source: SRC },
  { site: 'zgw', retailer: 'Plein.nl NL', countries: ['NL'], language: 'nl', row: 129, source: SRC },
].map(e => Object.freeze({ ...e, countries: Object.freeze([...e.countries]) })));

// { retailers, languages } of one site, spread into its deliversTo.
export function waveDelivery(code) {
  const retailers = {};
  const languages = {};
  for (const e of WAVE_A) {
    if (e.site !== code) continue;
    retailers[e.retailer] = [...e.countries];
    if (e.language) languages[e.retailer] = e.language;
  }
  return { retailers, languages };
}
