// Import rules for Ekster UK (Rakuten Advertising MID 53020 "Ekster UK", ekster.com, pounds) on Men's Gear World. Wave 1
// UK of the massive import (chat 7 sheet «Εγκρίσεις» row 155, 22-24 Nov 2026, lessons L224). Catalogue of 22 Nov 2026:
// 297 rows (about 60 pages): smart wallets and cardholders, key cases and holders, cash clips, coin pouches, tracker cards
// and tags, the GRID backpacks and the Weekender bag, TravelPack vacuum bags, bundles, a laptop sleeve, a phone case and
// gift cards.
//  - Wallets, cardholders and coin pouches to MGW Bags & Accessories > Wallets & Purses; backpacks, duffels, the
//    Weekender and the TravelPack bags to Bags.
//  - Key cases and holders, cash clips, tool and comb cards, tracker cards and tags to Everyday Carry / EDC.
//  - Gift cards, the gift bag, phone cases, stickers, powerbanks and the promotional bundles ("Black Friday Bundle",
//    L107) stay out; a bundle that names its wallet ("Ekster Wallet Bundle") stays as a wallet.
import { tidy } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'ekster-uk',
  network: 'rakuten',
  advertiserId: 53020,
  retailer: 'Ekster UK',
  currency: 'GBP',
  shop: /^https?:\/\/(www\.)?ekster\.com\//i,
  sites: ['mgw'],
  maxPrice: 500,
  minPrice: 15
};

export function displayBrand() { return 'Ekster'; }

export function classify({ name }) {
  const n = tidy(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?(card|bag)|black friday|\bcase\b(?! \+)|iphone|sticker|powerbank|backplate|air pump|camera cube|tech case|essentials bundle|fresh essentials/i.test(n) && !/key case/i.test(n)) {
    return { reject: 'gift card, phone or tech accessory, spare part or promotional bundle' };
  }
  const m = sub => ({ site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: sub, name: n });
  if (/backpack|duffel|weekender|travelpack|vacuum bag|travel bag/i.test(n)) return m('Bags');
  if (/wallet|cardholder|card holder|coin pouch/i.test(n)) return m('Wallets & Purses');
  if (/key (case|holder)|cash (clip|band)|tool card|comb card|tracker (card|tag)/i.test(n)) {
    return { site: 'mgw', siteCategory: 'Everyday Carry / EDC', subcategory: 'Everyday Carry / EDC', name: n };
  }
  return { reject: 'not a wallet, bag or everyday-carry item' };
}
