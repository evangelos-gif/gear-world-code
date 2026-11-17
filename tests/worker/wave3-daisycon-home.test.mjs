// Daisycon Wave 3, part 2 (chat 9, 17 Nov 2026): home shops with Dutch, German and French feeds on HGW (La Redoute NL/DE,
// Dille & Kamille NL/FR, Miss Towels, WoodWick, Kerstland, Baobab Collection) and Tuinmeubelwereld on GGW.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { homePlaceEu, pathParts } from '../../tools/import-rules/lib/home-eu.mjs';
import { daisyconPageField, programmeOf } from '../../tools/import-rules/lib/daisycon-home.mjs';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { deliveryCountries } from '../../src/lib/delivery.js';
import * as tmw from '../../tools/import-rules/tuinmeubelwereld-nl.mjs';
import hgw from '../../sites/hgw/site.config.js';
import ggw from '../../sites/ggw/site.config.js';

const HOME = {
  'laredoute-nl': [16029, 'La Redoute NL', 'NL', 'nl'], 'laredoute-de': [22318, 'La Redoute DE', 'DE', 'de'],
  'dillekamille-nl': [7059, 'Dille Kamille NL', 'NL', 'nl'], 'dillekamille-fr': [7739, 'Dille Kamille FR', 'FR', 'fr'],
  'misstowels-nl': [21226, 'Miss Towels', 'NL', 'nl'], 'woodwick-nl': [21919, 'WoodWick NL', 'NL', 'nl'], 'kerstland-nl': [22097, 'Kerstland', 'NL', 'nl'],
  'baobab-eu': [18705, 'Baobab Collection', 'FR', 'fr']
};
const at = (name, feedCategory, lang, brand = '') => {
  const p = homePlaceEu({ name, feedCategory, lang, brand });
  return p.reject ? 'out' : `${p.siteCategory} > ${p.subcategory}${p.doubt ? ' (check)' : ''}`;
};

test('home-eu: Dutch folders, read deepest first, with the word ENDING (glued words)', () => {
  assert.deepEqual(pathParts('Woontextiel|Beddengoed|Dekbedovertrekken > Woontextiel'), ['Dekbedovertrekken', 'Beddengoed', 'Woontextiel']);
  assert.equal(at('Dekbedovertrek in gewassen Lina', 'Woontextiel|Beddengoed|Dekbedovertrekken', 'nl'), 'Bedding & Bath > Duvet');
  assert.equal(at('Verduisteringsgordijn extra breed, Voda', 'Woontextiel|Raamdecoratie|Gordijnen', 'nl'), 'Home Decor > Curtain');
  assert.equal(at('Rolgordijn verduisterend', 'Woontextiel|Raamdecoratie|Rolgordijnen', 'nl'), 'Home Decor > Blinds', 'a roller blind, not a curtain');
  assert.equal(at('Bank Nova', 'Banken, fauteuils|Banken|2-zitsbank, 3-zitsbank', 'nl'), 'Furniture > Sofa');
  assert.equal(at('Hoeslaken', 'Woontextiel|Beddengoed|Kinderbeddengoed|Hoeslakens', 'nl'), 'Bedding & Bath > Bed Linen');
  assert.equal(at('Tafelkleed linnen', 'Woontextiel|Tafeltextiel|Tafelkleden', 'nl'), 'Kitchen & Dining > Table Linen', 'a table cloth is not a rug');
  assert.equal(at('Vloerkleed Afid', 'Vloerkleden|Woonkamer vloerkleden', 'nl'), 'Home Decor > Rug');
  assert.equal(at('Thee-/glazendoek, linnen/katoen', 'Keuken|Keukentextiel|Theedoeken > Keuken', 'nl'), 'Kitchen & Dining > Table Linen');
  assert.equal(at('Stompkaars, curry', 'Huis|Kaarsen|Stompkaarsen > Huis', 'nl'), 'Home Decor > Home Fragrance');
  assert.equal(at('Bloempot, zink', 'Huis|Woonaccessoires|Bloempotten > Huis', 'nl'), 'Home Decor > Ornament');
  assert.equal(at('Hanger, vilt, vos', 'Kerstdecoratie|Kerstboomversiering > Kerst', 'nl'), 'Home Decor > Christmas');
  assert.equal(at('Glendon kerstguirlande | groen', 'Huis en tuin|Decoratie|Seizoens- en feestdagdecora', 'nl'), 'Home Decor > Christmas');
  // A typo in a towel folder ("Badhandboeken", with "boeken" = books) does not throw the towel out.
  assert.equal(at('Miss Towels - Hotelkwaliteit Handdoek - Antraciet', 'Huis en tuin|Linnengoed|Handdoeken|Badhandboeken e', 'nl', 'Miss Towels'), 'Bedding & Bath > Towel');
  assert.equal(at('Kan, porselein, 1,1 liter', '', 'nl'), 'Kitchen & Dining > Drinkware (check)', 'no folder: the head of the name, listed under CHECK');
});

test('home-eu: Dutch food, cards, books and toys, covers and bathrobes stay out', () => {
  assert.equal(at('Vlierbloesem, biologisch, 35 g', 'Eten & drinken|Drinken|Thee|Kruidenthee > Eten & d', 'nl'), 'out');
  assert.equal(at('Kaart, vogelhuisje', '(no category)', 'nl'), 'out');
  assert.equal(at('Puzzel wereld, dubbelzijdig, rond', 'Speelgoed|Puzzels', 'nl'), 'out');
  assert.equal(at('Bankhoes Nova', 'Woontextiel|Hoezen', 'nl'), 'out');
  assert.equal(at('Badjas in biologisch katoen Kalou', 'Woontextiel|Badtextiel|Badjassen', 'nl'), 'out');
  assert.equal(at('Kussenhoes velvet', 'Woontextiel|Sierkussens|Kussenhoezen', 'nl'), 'Home Decor > Cushion', 'a cushion cover is a cushion');
});

test('home-eu: German folders (a "Bank" is a bench, a "Sofabezug" a cover, "Dekokissen" cushions)', () => {
  assert.equal(at('3- oder 4-Sitzer-Sofa Alwine', 'Sofa, Sessel|Sofa|Gerades Sofa > Gerades Sofa', 'de'), 'Furniture > Sofa');
  assert.equal(at('Schlafsofa TIMOR', 'Sofa, Sessel|Sofa|Schlafsofa|Klappsofa > Schlafsof', 'de'), 'Furniture > Sofa');
  assert.equal(at('Sessel Victor', 'Sofa, Sessel|Sessel|Wohnzimmersessel > Wohnzimmers', 'de'), 'Furniture > Armchair');
  assert.equal(at('Tischdecke mit Webkaro Bethany', 'Heimtextilien|Tischwäsche|Tischdecke > Tischdecke', 'de'), 'Kitchen & Dining > Table Linen');
  assert.equal(at('Thermovorhang Montego', 'Heimtextilien|Vorhang, Gardine|Vorhang > Vorhang', 'de'), 'Home Decor > Curtain');
  assert.equal(at('Bettbezug SABBAL', 'Heimtextilien|Bettwäsche|Bettbezug > Bettbezug', 'de'), 'Bedding & Bath > Duvet');
  assert.equal(at('Spannbettlaken Scenario', 'Heimtextilien|Bettwäsche|Spannbettlaken > Spannbet', 'de'), 'Bedding & Bath > Bed Linen');
  assert.equal(at('Kissenbezug Odile', 'Heimtextilien|Dekokissen, Kissenbezug|Kissenbezug', 'de'), 'Home Decor > Cushion');
  assert.equal(at('Kissenbezug Scenario', 'Heimtextilien|Bettwäsche|Kissenbezug, Nackenrollen', 'de'), 'Bedding & Bath > Pillow');
  assert.equal(at('Teppich Afid', 'Teppich|Wohnzimmerteppich', 'de'), 'Home Decor > Rug');
  assert.equal(at('Sitzbank Lunja', 'Möbel|Bank', 'de'), 'Furniture > Bench');
  assert.equal(at('Sofabezug Néo Chiquito, Samt', 'Sofa, Sessel|Sofabezug', 'de'), 'out');
  assert.equal(at('Kippsofabezug für eine neue Optik', 'Sofa, Sessel|Sofabezug', 'de'), 'out');
  assert.equal(at('Dokumentenhalter Lomopi', 'Büro|Schreibtischzubehör', 'de'), 'out', 'not sure: out');
});

test('home-eu: French folders and names (Dille & Kamille FR, Baobab Collection)', () => {
  assert.equal(at('Nappe ronde, coton bio GOTS', 'Maison et jardin|Linge|Linge de table|Nappes > Nap', 'fr'), 'Kitchen & Dining > Table Linen');
  assert.equal(at('Boule de Noël', 'Décorations de Noël pour le sapin', 'fr'), 'Home Decor > Christmas');
  assert.equal(at('Pot de fleur, céramique', 'Pots de fleur', 'fr'), 'Home Decor > Ornament');
  assert.equal(at('Cafetière à piston, acier inoxydable', 'Maison et jardin|Arts de la table et arts culinair', 'fr'), 'Kitchen & Dining > Tableware',
    '"Arts de la table" is tableware, never a side table');
  assert.equal(at('Thé pétillant, festif, 0,75 l', 'Thé en vrac', 'fr'), 'out');
  assert.equal(at('Carte, chat', 'Cartes', 'fr'), 'out');
  assert.equal(at('Baobab Collection - Bougie Parfumée Sand Siloli Classique - 10 cm', 'Siloli', 'fr', 'Baobab Collection'), 'Home Decor > Home Fragrance (check)');
  assert.equal(at('Baobab Collection - Recharge Stones Agate 1l', 'Agate', 'fr', 'Baobab Collection'), 'Home Decor > Home Fragrance (check)');
  assert.equal(at('Baobab Collection - Lotion Corps & Mains Women 350ml', 'Women', 'fr', 'Baobab Collection'), 'out', 'body care is not a home product');
  assert.equal(at('Baobab Collection - Eau de Parfum Messieurs 100ml', 'Messieurs', 'fr', 'Baobab Collection'), 'out');
});

test('each rules file: its Daisycon programme, a name legacy-import.ps1 accepts, and shown only in its own country and language (L165)', async () => {
  for (const [key, [id, retailer, country, lang]] of Object.entries(HOME)) {
    const r = await import(`../../tools/import-rules/${key}.mjs`);
    assert.equal(r.RULES.key, key);
    assert.equal(r.RULES.network, 'daisycon');
    assert.equal(r.RULES.advertiserId, id);
    assert.equal(r.RULES.retailer, retailer);
    assert.match(retailer, /^[A-Za-z0-9 .-]{2,40}$/);
    assert.deepEqual(r.RULES.sites, ['hgw']);
    assert.equal(r.RULES.currency, 'EUR');
    assert.ok(r.RULES.maxPerSubcategory > 0 && r.RULES.maxPerSubcategory <= 400, key);
    assert.deepEqual(hgw.deliversTo.retailers[retailer], [country], key);
    assert.equal(hgw.deliversTo.languages[retailer], lang, key);
    assert.deepEqual(deliveryCountries(hgw, retailer), [country], key);
  }
  assert.deepEqual(ggw.deliversTo.retailers.Tuinmeubelwereld, ['NL']);
  assert.equal(ggw.deliversTo.languages.Tuinmeubelwereld, 'nl');
  assert.equal(tmw.RULES.advertiserId, 19167);
  assert.deepEqual(tmw.RULES.sites, ['ggw']);
});

test('the shop page of a Daisycon link: from its "dl", else from the product number but only for a link of THIS programme', () => {
  const f = daisyconPageField('https://www.laredoute.nl/', 16029);
  const row = o => c => String(o[c] ?? '');
  assert.equal(programmeOf('https://fr135.net/c/?si=16029&li=1&wi=447289&dl=ppdp%2Fprod-1.aspx'), '16029');
  assert.equal(f('merchant_deep_link', row({ aw_deep_link: 'https://fr135.net/c/?si=16029&li=1&wi=447289&dl=ppdp%2Fprod-1.aspx' })),
    'https://www.laredoute.nl/ppdp/prod-1.aspx');
  assert.equal(f('merchant_deep_link', row({ aw_deep_link: 'https://fr135.net/c/?si=16029&li=1&wi=447289', merchant_product_id: 'LR 7' })),
    'https://www.laredoute.nl/#product-LR%207');
  assert.equal(f('merchant_deep_link', row({ aw_deep_link: 'https://fr135.net/c/?si=99999&li=1&wi=447289', merchant_product_id: '7' })), '',
    'a link of another programme: no page, so the row is left out');
  assert.equal(f('product_name', row({ product_name: 'x' })), 'x');
});

test('Tuinmeubelwereld: the head of the Dutch name says the piece, the folder only when it says nothing', () => {
  const p = (name, c = '') => { const r = tmw.classify({ name, feedCategory: c }); return r.reject ? 'out' : r.subcategory + (r.doubt ? ' (check)' : ''); };
  assert.equal(p('Palau/Tulum Lava Grey dining tuinset | 4 personen | teakhout + touw | 120cm rond'), 'Dining sets');
  assert.equal(p('Stockholm dining loungeset met hockers 8 personen | wicker'), 'Dining sets');
  assert.equal(p('Tulum ligbed | touw + aluminium | Stone Grey'), 'Loungers');
  assert.equal(p('Riva stokparasol antraciet | Ø250cm rond'), 'Parasols, gazebos & shade');
  assert.equal(p('Lima tuinstoel teak'), 'Chairs & benches');
  assert.equal(p('Bali loungeset 5-delig met kussens'), 'Lounge & corner sets', 'a set with cushions is a set');
  assert.equal(p('Kussen voor ligbed Tulum'), 'out');
  assert.equal(p('Tulum kussenset'), 'out');
  assert.equal(p('Ronda', 'Meubelen|Buitenmeubelen|Tuintafels > Tuintafels'), 'Tables (check)');
  assert.equal(p('Ronda', 'Meubelen|Iets'), 'out');
});

test('a whole dry run of La Redoute NL from a Daisycon file: placed, sizes joined, food and covers out, another programme out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hgw-lr-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(a);
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean,merchant_deep_link\n';
  const dc = (n, si = 16029) => `https://fr135.net/c/?si=${si}&li=1&wi=447289&pid=${n}`;
  writeFileSync(join(a, 'DAISYCON_16029.csv.gz'), gzipSync(head
    + `${dc(1)},"Dekbedovertrek in gewassen Lina, Limona blauw",1,LR-1A,https://img.example/1.jpg,Woontextiel|Beddengoed|Dekbedovertrekken,84.5,EUR,LA REDOUTE INTERIEURS,1,,\n`
    + `${dc(2)},"Dekbedovertrek in gewassen Lina, Limona blauw",2,LR-1B,https://img.example/1.jpg,Woontextiel|Beddengoed|Dekbedovertrekken,99.5,EUR,LA REDOUTE INTERIEURS,1,,\n`
    + `${dc(3)},"Fauteuil, stof met structuur, Victor",3,LR-3,https://img.example/3.jpg,"Banken, fauteuils|Fauteuils",674.25,EUR,AM.PM,1,,\n`
    + `${dc(4)},Bankhoes Nova,4,LR-4,https://img.example/4.jpg,Woontextiel|Hoezen,59,EUR,LA REDOUTE INTERIEURS,1,,\n`
    + `${dc(5, 20000)},Vloerkleed Afid,5,LR-5,https://img.example/5.jpg,Vloerkleden|Woonkamer vloerkleden,120,EUR,AM.PM,1,,\n`));
  const r = await planLegacyImport({ archive: a, retailer: 'laredoute-nl', outDir: join(dir, 'out'), now: new Date('2026-11-17T22:00:00Z') });
  const got = r.accepted.hgw.map(p => `${p.subcategory}: ${p.product_name} ${p.price}`).sort();
  assert.deepEqual(got, ['Armchair: Fauteuil, stof met structuur, Victor 674.25', 'Duvet: Dekbedovertrek in gewassen Lina, Limona blauw 84.5']);
  assert.ok(r.accepted.hgw.every(p => p.retailer === 'La Redoute NL' && p.currency === 'EUR' && /^https:\/\/fr135\.net\/c\/\?si=16029/.test(p.affiliate_url)),
    'the button goes through Daisycon\'s own link');
  assert.ok(r.accepted.hgw.every(p => p.awin_product_id.startsWith('dc16029:')));
  const reasons = Object.keys(r.rejected).join(' | ');
  assert.match(reasons, /a cover, sample, bathrobe or body care/);
  assert.match(reasons, /link is not the shop's own page/, 'a row of another programme never passes');
});

test('KidInn (Tradeinn, GBP): only what is for children, placed from Google\'s folders with the subcategories KGW has', async () => {
  const k = await import('../../tools/import-rules/kidinn.mjs');
  const kgw = (await import('../../sites/kgw/site.config.js')).default;
  assert.equal(k.RULES.advertiserId, 20605);
  assert.equal(k.RULES.currency, 'GBP');
  assert.deepEqual(k.RULES.sites, ['kgw']);
  assert.ok(!kgw.deliversTo.retailers.KidInn, 'pounds, ships to the UK: the default GB view');
  assert.deepEqual(k.splitWho('Nici Fox Plush 25 cm Orange  Kids'), { name: 'Nici Fox Plush 25 cm Orange', who: 'Kids' });
  const p = (name, c) => { const r = k.classify({ name, feedCategory: c }); return r.reject ? 'out' : `${r.siteCategory} > ${r.subcategory}${r.doubt ? ' (check)' : ''}`; };
  assert.equal(p('Iello Lpfi749 Board Game Multicolor  Kids', 'Toys & Games|Games|Board Games'), 'Toys & Games > Board Games');
  assert.equal(p('Nici Fox Plush 25 cm Orange  Kids', 'Toys & Games|Toys|Dolls, Playsets & Toy Figures|Stuffed Animals'), 'Toys & Games > Stuffed Animals & Cuddly Toys');
  assert.equal(p('Funko Marvel Shang-chi Razor Fist Figure Multicolor  Kids', 'Toys & Games|Toys|Dolls, Playsets & Toy Figures'), 'Toys & Games > Action & Toy Figures',
    'the general folder name holds dolls too, but is not a doll');
  assert.equal(p('Fresk Swallow Mini Backpack Pink  Kids', 'Luggage & Bags|Backpacks'), 'School & Backpacks > Backpacks');
  assert.equal(p('Atosa Pirate Costume Black 3-4 Years  Kids', 'Apparel & Accessories|Costumes & Accessories|Costumes'), 'Clothing > Costumes');
  assert.equal(p('Atosa Nurse Costume White M-L  Woman', 'Apparel & Accessories|Costumes & Accessories|Costumes'), 'out', 'an adult costume');
  assert.equal(p('Ravensburger Puzzle 1000 Pieces Multicolor  Unisex', 'Toys & Games|Puzzles'), 'Toys & Games > Jigsaw Puzzles', 'Unisex only in a toy folder');
  assert.equal(p('Oxford Binder 10 Units Multicolor  Unisex', 'Office Supplies|Filing'), 'out');
  assert.equal(p('Depesche Color Cloud Lunch Box Pink  Kids', 'Home & Garden|Kitchen & Dining|Food Storage'), 'out', 'not sure: out');
});
