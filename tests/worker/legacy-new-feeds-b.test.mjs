// New Awin feeds of 23 Oct 2026, wave B: Plusshop UK and Bazta UK (the same catalogue, two prices) on WGW, MGW, HGW,
// KGW and GGW; Viaduct Clothing (one card per product instead of one per size) on MGW, WGW and KGW; Beyond Shakers on HGW.
// Names and category paths are from the awin-feed-sample report of 23 Oct 2026; shop tags and types from the live shops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import * as plusshop from '../../tools/import-rules/plusshop.mjs';
import * as bazta from '../../tools/import-rules/bazta.mjs';
import * as viaduct from '../../tools/import-rules/viaduct.mjs';
import * as viaductWomen from '../../tools/import-rules/viaduct-women.mjs';
import * as shakers from '../../tools/import-rules/beyondshakers.mjs';
import * as sizes from '../../tools/cleanup-rules/viaduct-sizes.mjs';

const place = r => (r.reject ? `REJECT ${r.reject}` : `${r.site} | ${r.siteCategory} | ${r.subcategory}`);
const ps = (name, leaf, path, awin = '', brand = '') => place(plusshop.classify({ name, feedCategory: leaf, awinCategory: awin ? `${path} || ${awin}` : path, brand }));

test('Plusshop/Bazta: beauty to WGW, men to MGW (path or name), watches by who wears them', () => {
  assert.equal(ps('Maison Alhambra Unisex Oasis Eau De Parfum – 100 ml', 'Eau de parfum', 'Men > Women > Personal care > Personal Care > Fragrances > Eau de parfum > Arabian Perfumes', 'Fragrance'), 'wgw | Beauty & Fragrances | Fragrance');
  assert.equal(ps('Maison Alhambra Men’s Philos Rosso Eau De Parfum – 100 ml', 'Eau de parfum', 'Men > Women > Personal care > Personal Care > Fragrances > Eau de parfum'), 'mgw | Grooming & Fragrances | Fragrance');
  assert.equal(ps('Hugo Boss Dark Blue Eau de Toilette 75ml', 'Personal Care', 'Men > Personal Care > Fragrances > Eau de toilette', 'Bodycare & Fitness'), 'mgw | Grooming & Fragrances | Fragrance');
  assert.equal(ps('Calvin Klein IN2U Her - Eau de Toilette 100ml Spray', 'Personal care', 'Women > Personal care > Fragrances > Eau de toilette'), 'wgw | Beauty & Fragrances | Fragrance');
  assert.equal(ps('Gillette ProSheild Chill razor blades 4 pcs', 'Shaving & hair-cutting', 'Men > Women > Personal care > Shaving & hair-cutting'), 'mgw | Grooming & Fragrances | Shaving');
  assert.equal(ps('Proraso Beard Balm 100 ml', 'Personal Care', 'Men > Personal Care > Beard care'), 'mgw | Grooming & Fragrances | Beard care');
  assert.equal(ps('Beauty Formulas Aloe Vera Bikini Line Wax Strips - 36 pcs', 'Shaving & hair removal', 'Women > Personal care > Shaving & hair removal > Hair removal'), 'wgw | Beauty & Fragrances | Hair removal');
  assert.equal(ps('QVS Black Carbon Steel Eyelash Curler', 'Makeup', 'Women > Personal care > Makeup > Makeup accessories > SUMMER DEALS'), 'wgw | Beauty & Fragrances | Beauty tools');
  assert.equal(ps('Essence Lash Princess Cat Eye Mascara', 'Makeup', 'Women > Personal care > Makeup > Mascara'), 'wgw | Beauty & Fragrances | Make-up');
  assert.equal(ps('Elizabeth Arden Ceramide Vitamin C Capsules 30 pcs', 'Face care', 'Women > Personal care > Face & skin care > Face care'), 'wgw | Beauty & Fragrances | Skincare');
  assert.equal(ps('Zazie Toiletry Bag Pink', 'Personal care', 'Women > Personal care > Toiletry bags'), 'wgw | Bags & Accessories | Bags');
  assert.equal(ps('Casio LRW-200H-4CVDF Lady Diver Analog Sports Watch - White & Pink', 'Analog watches', 'Women > Accessories > Watches > Analog watches'), 'wgw | Watches | Watches');
  assert.equal(ps('Casio WS-1800-3AVEF Digital Sports Watch - Green', 'Sports watches', 'Men > Accessories > Watches > Sports watches'), 'mgw | Watches | Watches');
  assert.equal(ps('Vtech Kidizoom Smartwatch - Blue', "Children's watches", "Children > Baby & children products > Children's watches"), 'kgw | Kids Tech | Kids Smartwatches');
  assert.equal(ps('Peppa Pig 482608 Kids Analog Wrist Watch - Pink', 'Analog watches', 'Children > Accessories > Analog watches'), 'kgw | Accessories | Kids Watches');
});

test('Plusshop/Bazta: home cleaning, home fragrance, kitchen and smart home to HGW; garden and BBQ to GGW', () => {
  assert.equal(ps('Glade Pure Clean Linen Air Freshener Room Spray - 300 ml', 'Cleaning', 'Home > Household > Cleaning > Cleaning products > Air refresheners', 'Cleaning'), 'hgw | Home Decor | Home Fragrance');
  assert.equal(ps('Lenor Cotton Fresh Rinse Aid - 1 42L', 'Clean, iron & dry', 'Home > Household > Clean, iron & dry > Laundry > Fabric softener', 'Cleaning'), 'hgw | Cleaning & Laundry | Fabric Softener');
  assert.equal(ps('Ariel Liquid Colour Detergent - 1L', 'Clean, iron & dry', 'Home > Household > Clean, iron & dry > Laundry > Detergent'), 'hgw | Cleaning & Laundry | Laundry Detergent');
  assert.equal(ps('Swiffer Duster Kit XXL - Handle & 2 cloths', 'Steam mop & cleaner', 'Home > Household > Cleaning > Steam mop & cleaner > Cleaning products'), 'hgw | Cleaning & Laundry | Duster');
  assert.equal(ps('Erase Away Cleaning Pads – 2 Pcs', 'Cleaning', 'Home > Household > Cleaning > Cleaning products > Kitchen', 'Cleaning'), 'hgw | Cleaning & Laundry | Cloths & Sponges');
  assert.equal(ps('InnovaGoods Uncorker Electric Corkscrew', 'Kitchen', 'Home > Household > Kitchen > Bar'), 'hgw | Kitchen & Dining | Bar Accessories');
  assert.equal(ps('Scandinavia Bathroom Double-sided Mirror on Stand', 'Bathroom accessories', 'Home > Household > Bathroom accessories'), 'hgw | Bedding & Bath | Bathroom Accessories');
  assert.equal(ps('Byron Wireless WiFi & Video Doorbell - Black', 'Home security', 'Home > Household > Home security', 'Home Security'), 'hgw | Smart Home | Video Doorbell');
  assert.equal(ps('Black & Decker Spray Gun', 'Garden tools', 'Home > Household > HOT DEALS > Tools and garden appliances > Water hoses and accessories > Garden tools > Nozzles & spray guns > Garden', 'Garden Tools'), 'ggw | Watering & Irrigation | Spray Nozzles & Guns');
  assert.equal(ps('Wilkinson Sword Pruning shears', 'Garden tools', 'Home > Household > Tools and garden appliances > Garden tools > Tools > Pruning'), 'ggw | Garden Tools | Secateurs');
  assert.equal(ps('Black & Decker BBQ & Grill Cleaner Wipes - 20 pcs', 'Cleaning', 'Home > Household > Cleaning > Cleaning products', 'Cleaning'), 'ggw | BBQ & Outdoor Cooking | BBQ accessories');
  assert.equal(ps('BeNomad BBQ & Steak set', 'Cutting boards', 'Home > Household > Kitchen > Cutting boards'), 'ggw | BBQ & Outdoor Cooking | BBQ accessories');
  assert.equal(ps('Goobay LED Outdoor Floodlight 50W Black', 'Household', 'Home > Household > Lighting'), 'ggw | Outdoor Lighting & Garden Electrical | Floodlights & security lights');
});

test('Plusshop/Bazta: kids products to KGW (toys, baby, school, kids tech, outdoor)', () => {
  assert.equal(ps('LEGO 3D The LEGO Movie 2 School Bag', 'Baby & children products', 'Children > Baby & children products > School accessories > School bags & bags > SUMMER DEALS', "Children's Clothing"), 'kgw | School & Backpacks | School Bags');
  assert.equal(ps('Mega Bloks GRV37 Construction site', 'Toys', 'Children > Baby & children products > Activities & play time > Toys > Building & construction toys', 'Toys'), 'kgw | Toys & Games | Construction Set Toys');
  assert.equal(ps('Barbie Chelsea Doll with Shorts', 'Barbie dolls', 'Children > Baby & children products > Activities & play time > Toys > Dolls & accessories > Dolls > Barbie dolls'), 'kgw | Toys & Games | Dolls');
  assert.equal(ps('PAW Patrol Shuffle Dominoes Matching Game', 'Toys', 'Children > Baby & children products > Activities & play time > Toys > Games > Games', 'Toys'), 'kgw | Toys & Games | Board Games');
  assert.equal(ps('Nerf N-Strike Elite Accustrike Refill - 24 pcs', 'Toy weapons', 'Children > Baby & children products > Activities & play time > Toys > Toy weapons'), 'kgw | Toys & Games | Toy Weapons & Gadgets');
  assert.equal(ps('Keel Toys Signature Cuddle Puppies Dog 25cm', 'Toys', 'Children > Baby & children products > Activities & play time > Toys > Soft toys'), 'kgw | Toys & Games | Stuffed Animals & Cuddly Toys');
  assert.equal(ps('Vital Baby Nurture Fast Flow Bottle Nipples - 2 pcs', 'Bottles & accessories', 'Children > Baby & children products > Bottles & accessories'), 'kgw | Baby & Toddler | Baby Bottle Teats & Liners');
  assert.equal(ps('MAM Perfect Pacifier 0 months - Blue', 'Baby & children products', 'Children > Baby & children products > Pacifiers'), 'kgw | Baby & Toddler | Baby Soothers');
  assert.equal(ps('Angelcare Soft-Touch Bath Chair – Aqua', 'Bathroom & care', 'Children > Baby & children products > Bathroom & care > Baby bath & bath accessories'), 'kgw | Baby & Toddler | Baby Bathtubs & Bath Seats');
  assert.equal(ps('myFirst Insta Wi Camera Yellow', 'Remote controlled toys', 'Children > Baby & children products > Activities & play time > Toys > Remote controlled toys'), 'kgw | Kids Tech | Kids Cameras');
  assert.equal(ps('Intex Lifejacket', 'Activities & play time', 'Children > Baby & children products > Activities & play time > Outdoor toys'), 'kgw | Sports & Outdoors | Water Play Equipment');
});

test('Plusshop/Bazta: adult, pet, car, health, cards and electronics are never placed', () => {
  assert.equal(ps('BlowYo Extreme Wave Intense Oral Super Stroker', 'Intimate', 'Men > Women > Personal care > Personal Care > Intimate', 'Adult Toys'), 'REJECT adult product');
  assert.equal(ps('Pjur Analyse Me! Lubricant - 100ml', 'Cream, gel & oils', 'Men > Women > Personal care > Personal Care > Intimate > Cream, gel & oils > Lube', '', 'Pjur'), 'REJECT adult product');
  assert.equal(ps('Sex & Mischief Sparkle Bling Whip - 78cm', 'Intimate play', 'Men > Women > Personal care > Personal Care > Intimate > Intimate play'), 'REJECT adult product');
  assert.equal(ps('Billy Boy Sensual variety condoms - 3 pcs', 'Intimate', 'Men > Women > Personal care > Personal Care > Intimate', '', 'Billy Boy'), 'REJECT adult product');
  assert.equal(ps('Hunter Yuroma Rugby Toy', 'Household', 'Home > Household > Pet accessories > Toys > SUMMER DEALS', 'Car Accessories'), 'REJECT pet product');
  assert.equal(ps('Little Trees New Car Air Freshener', 'Car & bike', 'Home > Household > Car & bike > Auto > Air Freshener', 'Car Accessories'), 'REJECT car or bike product (not on these sites)');
  assert.equal(ps('Turtle Wax Wheel Wizard Easy Clean Brush', 'Cleaning', 'Home > Household > Cleaning > Cleaning products', 'Cleaning'), 'REJECT car or bike product (not on these sites)');
  assert.equal(ps('Colgate Max White One Toothpaste - 75ml', 'Dental care', 'Men > Women > Personal care > Dental care'), 'REJECT health or dental product');
  assert.equal(ps('Always Ultra Normal Sanitary Towels', 'Hygiene', 'Women > Personal care > Hygiene > Sanitary towels'), 'REJECT health, dental or hygiene product (not beauty)');
  assert.equal(ps('Giftmaker Christmas card - Let it Snow', 'Christmas', 'Home > Household > Christmas > Christmas cards & gift wrap'), 'REJECT cards, gift wrap or party items');
  assert.equal(ps('BasicPlus iPhone 12 Mini Cover - Black Marble', 'Covers, cases & holders', 'Electronics & accessories > Accessories for phones and tablets > Covers, cases & holders', 'Mobile Phone Accessories'), 'REJECT electronics accessory (Technology Gear World, later)');
  assert.equal(ps('Smartware Fake Security Camera Silver', 'Home security', 'Home > Household > Home security', 'Home Security'), 'REJECT fake security camera');
  assert.equal(ps('Raid Ant & Cockroach Powder - 250g', 'Tools and garden appliances', 'Home > Household > Tools and garden appliances > Pest control'), 'REJECT pest control');
  assert.equal(ps('Kleenex Family Maxi Pack - 128 pcs', 'Bathroom accessories', 'Home > Household > Bathroom accessories'), 'REJECT paper consumables');
});

// Mistakes found in the first wave B dry run (23 Oct 2026, the owner's report): real names and category paths.
test('Plusshop/Bazta dry-run fixes: beauty tools, deodorant, men\'s wash bags, nail clippers, watch straps, intimate care', () => {
  const W = 'Women > Personal care';
  assert.equal(ps('e.l.f. Angled Foundation Brush', 'Makeup', `${W} > Makeup > Foundation`), 'wgw | Beauty & Fragrances | Beauty tools');
  assert.equal(ps('Revlon Essentials Flat Brush', 'Makeup', `${W} > Makeup`), 'wgw | Beauty & Fragrances | Beauty tools');
  assert.equal(ps('Rexona Women Motionsense Invisible Pure Spray 150 ml', 'Deodorant', `${W} > Deodorant`), 'wgw | Beauty & Fragrances | Bath & body');
  assert.equal(ps('Technic Man\' Stuff Toiletry Bag Gift Box', 'Personal care', 'Men > Women > Personal care > Toiletry bags'), 'mgw | Grooming & Fragrances | Gift sets');
  assert.equal(ps('The Fuzzy Duck Bergamot, Hemp & Sandalwood Men\'s Luxury Toiletry Wash Bag Gift Set', 'Personal care', 'Men > Women > Personal care > Toiletry bags'), 'mgw | Grooming & Fragrances | Gift sets');
  assert.equal(ps('Body Collection Self Care Toiletry Bag Christmas Calendar - 24 pieces', 'Personal care', `${W} > Toiletry bags`), 'wgw | Beauty & Fragrances | Gift sets');
  assert.equal(ps('Carrera Jeans Underground Toiletry Bag', 'Personal care', 'Men > Women > Personal care > Toiletry bags'), 'wgw | Bags & Accessories | Bags');
  assert.equal(ps('Beter Pedicure Nail Clippers', 'Shaving & hair-cutting', 'Men > Women > Personal care > Shaving & hair-cutting'), 'wgw | Beauty & Fragrances | Nails');
  assert.equal(ps('Beter Nose & Ear Hair Trimmer', 'Shaving & hair-cutting', 'Men > Women > Personal care > Shaving & hair-cutting'), 'mgw | Grooming & Fragrances | Trimmers & clippers');
  assert.equal(ps('Gillette Women Simply Venus 4 pcs', 'Shaving & hair removal', `${W} > Shaving & hair removal`), 'wgw | Beauty & Fragrances | Hair removal');
  assert.equal(ps('Sesderma Nanocare Intimate Velvet Care Gel - 30 ml', 'Hygiene', `${W} > Hygiene`), 'REJECT health, dental or hygiene product (not beauty)');
  assert.equal(ps('Domestos Dhalia & Dragon Fruit Toilet Rim Block – 4-Pack', 'Hygiene', 'Men > Women > Personal care > Hygiene'), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps("L'Oréal Paris Wrinkle Expert 65+ Anti-Wrinkle Fortifying Night Cream with Multivitamins - 50 ml", 'Face cream', `${W} > Face & skin care > Face cream`), 'wgw | Beauty & Fragrances | Skincare');
  assert.equal(ps('Nivea Cream Care Shower – 250ml', 'Hygiene', 'Men > Women > Personal care > Hygiene', 'Medical'), 'wgw | Beauty & Fragrances | Bath & body');
  assert.equal(ps('Australian Bodycare Femigel - 25ML', 'Personal care', `${W}`, 'Medical'), 'REJECT health or dental product');
  assert.equal(ps('Palmolive Aquarium Hand Soap 300ml', 'Hand wash', 'Men > Women > Personal care > Hygiene > Hand wash'), 'wgw | Beauty & Fragrances | Bath & body');
  const M = 'Men > Accessories > Watches > Wristwatches';
  assert.equal(ps('Apple Watch 42/44 mm Silicone Strap White', 'Wristwatches', M), 'REJECT watch strap or box (not a watch)');
  assert.equal(ps('Aluminium Watch Box Black - 5 Watches', 'Wristwatches', M), 'REJECT watch strap or box (not a watch)');
  assert.equal(ps('Garmin Fenix 6 Strap 22 mm White', 'Wristwatches', M), 'REJECT watch strap or box (not a watch)');
  assert.equal(ps('GANT Sevenhill GT062006 - 41mm', 'Wristwatches', M), 'mgw | Watches | Watches');
  assert.equal(ps('Kenneth Cole 10022939 47mm', 'Digital watches', 'Men > Accessories > Watches > Digital watches'), 'mgw | Watches | Watches');
  assert.equal(ps('Casio Classic F-91W-1YEG Digital Watch - Black Resin Strap', 'Digital watches', 'Men > Accessories > Watches > Digital watches'), 'mgw | Watches | Watches');
});

test('Plusshop/Bazta dry-run fixes: kitchen, cleaning, home fragrance, bathroom and smart home on HGW', () => {
  const K = 'Home > Household > Kitchen';
  assert.equal(ps('Bacofoil The Original Kitchen Foil - 300mm x 5m', 'Kitchen', K), 'hgw | Kitchen & Dining | Kitchen Utensil');
  assert.equal(ps('Palmolive Ultra Original Dish Soap - 750ml', 'Kitchen', K), 'hgw | Cleaning & Laundry | Dishwashing');
  assert.equal(ps('Cif Original Scouring Cream - 500ml', 'Kitchen', K), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps('Kilrock Bathroom & Kitchen Drain Unblocker – 1000ml', 'Kitchen', K), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps('Flash Spray Wipe Done Multi Surface Spray - 800ml', 'Kitchen', K), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps('La Baleine Coarse Sea Salt Shaker - 250 g', 'Kitchen', K), 'REJECT food or drink (not on these sites)');
  assert.equal(ps('Vacu Vin Cocktail Shaker', 'Kitchen', `${K} > Bar`), 'hgw | Kitchen & Dining | Bar Accessories');
  assert.equal(ps('Aluminium 3 Cups Stovetop Espresso Coffee Maker - 150 ml', 'Kitchen', K), 'hgw | Kitchen & Dining | Cookware');
  assert.equal(ps('Woll Nowo Steel Frying Pan - Ø 28', 'Kitchen', K), 'hgw | Kitchen & Dining | Frying Pan');
  assert.equal(ps('Marie Sohl Cutlery set - 16 pieces', 'Cutlery', `${K} > Cutlery`), 'hgw | Kitchen & Dining | Cutlery');
  assert.equal(ps('Privilege Cutlery Holder Transparent - 33cm x 25cm x 5cm', 'Kitchen', K), 'hgw | Kitchen & Dining | Kitchen Utensil');
  const C = 'Home > Household > Cleaning > Cleaning products';
  assert.equal(ps('Swiffer Duster Limited Edition Pink Dust Magnet Refills with Febreze Scent - 9 pcs', 'Cleaning', C), 'hgw | Cleaning & Laundry | Duster');
  assert.equal(ps('Ariel Platinum + Febreze Odour Defence Laundry Pods - 19 pcs', 'Clean, iron & dry', 'Home > Household > Clean, iron & dry > Laundry > Detergent'), 'hgw | Cleaning & Laundry | Laundry Detergent');
  assert.equal(ps('Febreze Spring Awakening Fabric Refresher Spray - 500 ml', 'Cleaning', `${C} > Air refresheners`), 'hgw | Home Decor | Home Fragrance');
  assert.equal(ps('YUGOU Bag It Scented Drawstring Bag - Lovely Lavender', 'Cleaning', C), 'hgw | Cleaning & Laundry | Bins & Bin Bags');
  assert.equal(ps('Classic Forever Black Laundry Detergent – 600ml', 'Clean, iron & dry', 'Home > Household > Clean, iron & dry > Laundry > Fabric softener'), 'hgw | Cleaning & Laundry | Laundry Detergent');
  assert.equal(ps('Xiaomi Mi Robot Vacuum Essential Mop Cloth', 'Vacuum cleaners', 'Home > Household > Cleaning > Vacuum cleaners'), 'hgw | Cleaning & Laundry | Vacuum Accessories');
  assert.equal(ps('Disiclin Pet‑Friendly Multi‑Surface Cleaner – 1000ml', 'Cleaning products', C), 'hgw | Cleaning & Laundry | Cleaning Products');
  const B = 'Home > Household > Bathroom accessories';
  assert.equal(ps('Duck Deep Action Citrus Toilet Gel – 750 ml', 'Bathroom accessories', B), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps('Blooo Power Active Flower Toilet Rim Block - 50g', 'Bathroom accessories', B), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps('Moistura By Cyclax Velvet Rosewood Hand Wash - 500 ml', 'Bathroom accessories', B), 'wgw | Beauty & Fragrances | Bath & body');
  assert.equal(ps('Radox Muscle Therapy Bath Soak - 500ml', 'Bathroom accessories', B), 'wgw | Beauty & Fragrances | Bath & body');
  assert.equal(ps('Technic Vintage Cherry Blossom Luxury Toiletry Adventskalendar', 'Bathroom accessories', B), 'wgw | Beauty & Fragrances | Gift sets');
  assert.equal(ps('CS Beauty Bamboo Cotton buds - 300 pcs', 'Bathroom accessories', B), 'REJECT health, dental or hygiene product (not beauty)');
  assert.equal(ps('Tristar WG2419 Bath scale', 'Bathroom accessories', B), 'hgw | Bedding & Bath | Bathroom Accessories');
  const S = 'Home > Household > Home security';
  assert.equal(ps('Smartwares FSM-12004 Smoke Alarm', 'Home security', S, 'Home Security'), 'hgw | Smart Home | Smoke Alarm');
  assert.equal(ps('König Door / Window Sensor', 'Home security', S, 'Home Security'), 'hgw | Smart Home | Smart Sensor');
  assert.equal(ps('KSIX Motion Sensor', 'Home security', S, 'Home Security'), 'hgw | Smart Home | Motion Sensor');
  assert.equal(ps('Nedis Wireless Doorbell Set - White', 'Home security', S, 'Home Security'), 'hgw | Smart Home | Wireless Doorbell');
  assert.equal(ps('Perel lamp - 20W', 'Home security', S, 'Home Security'), 'REJECT not a smart home or security device');
});

test('Plusshop/Bazta dry-run fixes: kids products land on the right KGW page, garden on GGW\'s own pages', () => {
  const C = 'Children > Baby & children products';
  const O = `${C} > Activities & play time > Outdoor toys`;
  const T = `${C} > Activities & play time > Toys`;
  assert.equal(ps('Frosch Baby Cleanser', 'Baby & children products', C), "REJECT children's product not in these plans");
  assert.equal(ps('We Made Me Imagine Baby Carrier', 'Baby & children products', C), 'kgw | Baby & Toddler | Baby Carriers');
  assert.equal(ps('LOL Surprise Sticker by Number Activity Book', 'Toys', `${T} > Dolls & accessories`), 'kgw | Toys & Games | Toy Craft Kits');
  assert.equal(ps('Hot Wheels Let\'s Race Jumbo Colouring Book', 'Toys', T), 'kgw | Toys & Games | Toy Craft Kits');
  assert.equal(ps('Janod WWF Animal Puzzle - 9 Pieces', 'Toys', `${T} > Building & construction toys`), 'kgw | Toys & Games | Jigsaw Puzzles');
  assert.equal(ps('Bicycle Bourbon Playing Cards', 'Activities & play time', O), 'kgw | Toys & Games | Card Games');
  assert.equal(ps('Beast Blitz Dino Battle Dart Guns Assorted', 'Activities & play time', O), 'kgw | Toys & Games | Toy Weapons & Gadgets');
  assert.equal(ps('Tomy Toomies Bath Activity Octopus', 'Baby toys', `${C} > Baby toys`), 'kgw | Baby & Toddler | Bath Toys');
  assert.equal(ps('Crackle Baff Colours Bath Powder – 6 pcs', 'Activities & play time', O), 'kgw | Baby & Toddler | Bath Toys');
  assert.equal(ps('Power Play Table Top Pool Table', 'Activities & play time', O), 'kgw | Toys & Games | Toys & Games');
  assert.equal(ps('Barbie Pop Reveal Bubble Tea Series – Green Tea', 'Toys', `${T} > Dolls & accessories`), 'kgw | Toys & Games | Dolls');
  assert.equal(ps('HTI Police Helmet', 'Activities & play time', O), 'kgw | Toys & Games | Pretend Professions & Role Playing');
  assert.equal(ps('Fisher Price Imaginext DC Super Friends Batman Bicycle', 'Activities & play time', O), 'kgw | Toys & Games | Action & Toy Figures');
  assert.equal(ps('Molto Bike Helmet Pink - 48-53cm', 'Activities & play time', O), 'kgw | Sports & Outdoors | Cycling Helmets');
  assert.equal(ps('Janod Mademoiselle Pink Balance Bike - 3-5 Years', 'Activities & play time', O), 'kgw | Sports & Outdoors | Bicycles');
  assert.equal(ps('Intex Snorkelling set', 'Activities & play time', O), 'kgw | Sports & Outdoors | Water Play Equipment');
  assert.equal(ps('Vileda Multi Latex Disposable Gloves M/L - 50 pcs', 'Changing', `${C} > Changing`), 'hgw | Cleaning & Laundry | Cleaning Gloves');
  assert.equal(ps('Swaddle Me Original Swaddle 2-Pack - Small', 'Baby & children products', C), 'kgw | Baby & Toddler | Swaddling Blankets');
  assert.equal(ps('Pampers Baby-Dry Size 7 (15+kg) 20 pcs.', 'Changing', `${C} > Changing`), 'kgw | Baby & Toddler | Nappies');
  assert.equal(ps('My Little Miracle Snappy Baby Shampoo – 500ml', 'Bathroom & care', `${C} > Bathroom & care`), 'kgw | Baby & Toddler | Baby Bathing');
  assert.equal(ps('Lamaze Pile & Play Cups', 'Baby toys', `${C} > Baby toys`), 'kgw | Baby & Toddler | Sorting & Stacking Toys');
  assert.equal(ps('Philips Avent SCF330 Breast Pump with 3 Cups', 'Eat & drink', `${C} > Eat & drink`), 'kgw | Baby & Toddler | Breast Pumps');
  assert.equal(ps('Kikka Boo Silicone Spoons with Suction Cup – Mint – 2 pcs', 'Eat & drink', `${C} > Eat & drink`), 'kgw | Baby & Toddler | Nursing & Feeding');
  assert.equal(ps('MAM Fun To Drink Drinking Cup - 270ml', 'Eat & drink', `${C} > Eat & drink`), 'kgw | Baby & Toddler | Sippy Cups');
  assert.equal(ps('Planet Buddies Noah the Whale Tablet Holder', 'Baby & children products', C), 'kgw | Kids Tech | Kids Tech');
  assert.equal(ps('Red LCD Graphic Drawing Tablet 8.5"', 'Baby & children products', C), 'kgw | Kids Tech | Toy Drawing Tablets');
  assert.equal(ps('Bontempi Baby Melody Desk with Light and Sound Effect', 'Creative toys', `${C} > Activities & play time > Creative toys`), 'kgw | Toys & Games | Musical Toys');
  const G = 'Home > Household > Tools and garden appliances > Garden tools';
  assert.equal(ps('WOLF-Garten Classic Garden Shears', 'Garden tools', G), 'ggw | Garden Tools | Garden Shears');
  assert.equal(ps('Grouw Planting shovel Wide', 'Garden tools', G), 'ggw | Garden Tools | Hand Forks & Trowels');
  assert.equal(ps('Gardena Comfort Hand Cultivator', 'Garden tools', G), 'ggw | Garden Tools | Cultivators & Grubbers');
  assert.equal(ps('Dangrill Grill Spade - 45cm', 'Garden tools', G), 'ggw | BBQ & Outdoor Cooking | BBQ accessories');
  assert.equal(ps('Black & Decker Impulse Sprinkler', 'Garden tools', 'Home > Household > Tools and garden appliances > Water hoses and accessories'), 'ggw | Watering & Irrigation | Garden Sprinklers');
  assert.equal(ps('Ferrestock Garden hose', 'Garden tools', 'Home > Household > Tools and garden appliances > Water hoses and accessories'), 'ggw | Watering & Irrigation | Hose Pipes');
});

// The second dry run (24 Oct 2026): what was still on the wrong page or left out.
test('Plusshop/Bazta second dry-run fixes: watch kits, baby pages KGW already has, outdoor games, kitchen cleaners, grooming', () => {
  const C = 'Children > Baby & children products';
  const O = `${C} > Activities & play time > Outdoor toys`;
  assert.equal(ps('Repair kit for watches', 'Wristwatches', 'Men > Accessories > Watches > Wristwatches'), 'REJECT watch strap or box (not a watch)');
  assert.equal(ps('A|X Armani Exchange AX5900 ZOE', 'Wristwatches', 'Women > Accessories > Watches > Wristwatches'), 'wgw | Watches | Watches');
  assert.equal(ps('Philips Avent Ultra Air Silicone 6-12 Months Baby Girl Pacifiers – 2 pcs', 'Baby & children products', C), 'kgw | Baby & Toddler | Baby Soothers');
  assert.equal(ps('Swaddle Me Original - Elephants & Rainbows', 'Changing', `${C} > Changing`), 'kgw | Baby & Toddler | Swaddling Blankets');
  assert.equal(ps('Tommee Tippee Twist & Click Advanced Nappy Disposal Bin', 'Changing', `${C} > Changing`), 'kgw | Baby & Toddler | Nappy Buckets');
  assert.equal(ps('Angelcare nappy pail & 5 refill cassettes', 'Changing', `${C} > Changing`), 'kgw | Baby & Toddler | Nappy Buckets');
  assert.equal(ps('MAM Micro Steriliser', 'Baby & children products', C), 'kgw | Baby & Toddler | Bottle Warmers & Sterilisers');
  assert.equal(ps('Diono Pushchair rain cover', 'Baby & children products', C), 'kgw | Baby & Toddler | Baby Pushchair & Pram Accessories');
  assert.equal(ps('Summer Infant Learn-to-Sit High Chair', 'Eat & drink', `${C} > Eat & drink`), 'kgw | Baby & Toddler | High Chairs & Boosters Seats');
  assert.equal(ps('Tommee Tippee Grobag Snuggle 1 Pink - 0-4 months', "Decor & children's room", `${C} > Decor & children's room`), 'kgw | Baby & Toddler | Baby & Toddler Sleepwear');
  assert.equal(ps('Kikka Boo Silicone Training Spoons with Suction Cup – Pink – 2 pcs', 'Baby & children products', C), 'kgw | Baby & Toddler | Nursing & Feeding');
  assert.equal(ps('Nivea Sun Kids Sunscreen SPF50+ - 250ml', 'Baby & children products', C), 'kgw | Baby & Toddler | Baby Bathing');
  assert.equal(ps('LeapFrog Bright Colors Fruit Learning Smoothie Toy Cup - Assorted', 'Baby toys', `${C} > Baby toys`), 'kgw | Baby & Toddler | Baby Activity Toys');
  assert.equal(ps('Thomas & Friends Edward Diecast Push-Along Toy Train', 'Toys', `${C} > Activities & play time > Toys`), 'kgw | Toys & Games | Toy Trains & Train Sets');
  assert.equal(ps('SmartGames Go Genius Football Board Game', 'Activities & play time', O), 'kgw | Toys & Games | Board Games');
  assert.equal(ps('Bestway Hose bathing ring 91cm', 'Activities & play time', O), 'kgw | Sports & Outdoors | Water Play Equipment');
  assert.equal(ps('Aqua Shot Mega Pack Water Blasters – 4 pcs', 'Activities & play time', O), 'kgw | Sports & Outdoors | Water Play Equipment');
  assert.equal(ps('HTI Action Mission Target Mission Shooting Set', 'Activities & play time', O), 'kgw | Toys & Games | Toy Weapons & Gadgets');
  const K = 'Home > Household > Kitchen';
  assert.equal(ps('Stardrops The Pink Stuff Squeezy Scrubber', 'Kitchen', K), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps('Cif Power & Shine Kitchen Spray - 700ml', 'Kitchen', K), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps('Bref Power Lime & Dirt Remover - 750ml', 'Kitchen', K), 'hgw | Cleaning & Laundry | Cleaning Products');
  assert.equal(ps('Gillette Satin Care Sensitive Gel - 200ml', 'Shaving & hair-cutting', 'Men > Women > Personal care > Shaving & hair-cutting'), 'wgw | Beauty & Fragrances | Hair removal');
  assert.equal(ps('Axe Black Deo Spray - 150ml', 'Personal Care', 'Men > Personal Care'), 'mgw | Grooming & Fragrances | Deodorant');
  assert.equal(ps('La Roche-Posay Anthelios SPF50 Anti-Shine Mist - 75ml', 'Body care', 'Women > Personal care > Body care'), 'wgw | Beauty & Fragrances | Skincare');
  assert.equal(ps('Revlon Large Round Hair Brush', 'Hair care & styling', 'Women > Personal care > Hair care & styling'), 'wgw | Beauty & Fragrances | Hair tools');
  assert.equal(ps('Technic Nail Beauty Case Kit - 12 pieces', 'Personal care', 'Women > Personal care > Toiletry bags'), 'wgw | Beauty & Fragrances | Gift sets');
  assert.equal(ps('Scandinavia Bathroom Toothbrush Holder - Green', 'Toilet and bathroom', 'Men > Women > Personal care > Toilet and bathroom'), 'hgw | Bedding & Bath | Bathroom Accessories');
  assert.equal(ps('Colgate Max White One Toothpaste - 75ml', 'Dental care', 'Men > Women > Personal care > Dental care'), 'REJECT health or dental product');
});

// Sorting of 24 Oct 2026: products the import left in the general group (subcategory = category name) or on the wrong
// page, with real names and feed folders from the WGW and KGW databases. They get a page the site already has.
test('Plusshop/Bazta sorting: WGW beauty products leave the general group for the page they belong on', () => {
  const W = 'Women > Personal care';
  const wgw = sub => `wgw | Beauty & Fragrances | ${sub}`;
  assert.equal(ps('Dolce & Gabbana Light Blue Intense 50ML', 'Personal care', W), wgw('Fragrance'));
  assert.equal(ps('Arden Beauty - Eau De Parfume 100ml', 'Personal care', W), wgw('Fragrance'));
  assert.equal(ps('Elizabeth Arden Green Tea Nectarine Blossoms', 'Personal care', W), wgw('Fragrance'));
  assert.equal(ps('Elizabeth Arden Green Tea Deodorant - 150ml', 'Fragrances', W), wgw('Bath & body'));
  assert.equal(ps('Palmolive Milk & Honey Shower 250ml', 'Personal care', W), wgw('Bath & body'));
  assert.equal(ps('Palmolive Aroma Essence Love In Bloom Shower Gel - 250 ml', 'Bodyshampoo & shower gel', W), wgw('Bath & body'));
  assert.equal(ps('Nivea Cashmere & Cottonseed Body Shampoo - 250ml', 'Cream & lotion', W), wgw('Bath & body'));
  assert.equal(ps('GOSH Hand & Nail Cream - 30ML', 'Personal care', W), wgw('Bath & body'));
  assert.equal(ps('Heathcote & Ivory Cloud Nine Hand & Nail Care Bag – 3 Pcs', 'Personal care', W), wgw('Gift sets'));
  assert.equal(ps('Afnan 9PM Rebel Eau De Parfum, Shower Gel & Deodorant Spray Gift Set', 'Eau de parfum', W), wgw('Fragrance'));
  assert.equal(ps('Dove Body Love Gradual Tanning Mousse - 150ml', 'Face & skin care', W), wgw('Skincare'));
  assert.equal(ps('b.tan Just Act Natural Bronzing Water Mousse - 200ml', 'Face & skin care', W), wgw('Skincare'));
  assert.equal(ps('Bondi Sands Self Tanning Glove', 'Personal care', W), wgw('Beauty tools'));
  assert.equal(ps('Velvotan Original Tanning Mitt - Assorted', 'Face & skin care', W), wgw('Beauty tools'));
  assert.equal(ps('Pantene Pro-V Miracles Hydration Sorbet Mask – 160 ml', 'Personal care', W), wgw('Hair care'));
  assert.equal(ps('Olaplex No.0 Intensive Bond Building Hair Treatment - 155 ml', 'Personal care', W), wgw('Hair care'));
  assert.equal(ps('Australian Bodycare Hair Loss Serum - 100 ml', 'Hair treatments, oil & serum', W), wgw('Hair care'));
  assert.equal(ps('Veet Silky Fresh Hair Removal Cream Normal Skin 100 ml', 'Shaving & hair removal', W), wgw('Hair removal'));
  assert.equal(ps('Zazie Hairpins - 250 pcs', 'Personal care', W), wgw('Hair care'));
  assert.equal(ps('Better Comb', 'Personal care', W), wgw('Hair tools'));
  assert.equal(ps('So Eco Cutting Kam', 'Hair brushes', W), wgw('Hair tools'));
  assert.equal(ps('M2 Beauté Eyelash comb', 'Lashes & brows', W), wgw('Make-up'));
  assert.equal(ps('London Pride Pro Eyebrow Brush', 'Makeup accessories', W), wgw('Beauty tools'));
  assert.equal(ps('Real Techniques Brush Crush Blush', 'Makeup accessories', W), wgw('Beauty tools'));
  assert.equal(ps('Wet Brush Original Detangler Hair Brush - Black', 'Hair brushes', W), wgw('Hair tools'));
  assert.equal(ps('W7 Lash Applicator', 'Eyes', W), wgw('Beauty tools'));
  assert.equal(ps('Artdeco Accessories Duo Pencil Sharpener', 'Personal care', W), wgw('Beauty tools'));
  assert.equal(ps('LastSwab Beauty Swab', 'Sustainable', W), wgw('Beauty tools'));
  assert.equal(ps('AR Home Makeup Ogranizer - 26x7x29cm', 'Mirrors & organizers', W), wgw('Beauty tools'));
  assert.equal(ps('Vaseline Pure Petroleum Original Jelly - 250ml', 'Lips', W), wgw('Skincare'));
  assert.equal(ps('NYX Soft Matte Lip Cream Montreal', 'Lips', W), wgw('Make-up'));
  assert.equal(ps('Artdeco Waterproof Soft Lipliner 186', 'Lipliner', W), wgw('Make-up'));
  assert.equal(ps('Australian Bodycare Spot Stick', 'Blackhead & pimple removers', W), wgw('Skincare'));
  assert.equal(ps('Moroccanoil Body Pure Argan Oil 50ml', 'Handcream & oil', W), wgw('Bath & body'));
  assert.equal(ps('Beter Foot File', 'Personal care', W), wgw('Nails'));
  assert.equal(ps('Titania Foot Care Foot Cream - 100 ml', 'Manicure & pedicure', W), wgw('Bath & body'));
  assert.equal(ps('SUNkissed 25 Days of Beauty Christmas Calendar - 25 parts', 'Personal care', W), wgw('Gift sets'));
  assert.equal(ps('Technic Glam Squad Makeup Collection Set - 7 pieces', 'Personal care', W), wgw('Gift sets'));
  assert.equal(ps('Baylis & Harding Boudoire Tropical Paradise Vanity Beauty Bag', 'Body lotion', W), wgw('Gift sets'));
  assert.equal(ps('Beauty Formulas Aloe Vera Gel - 100ml', 'Personal Care', W), wgw('Skincare'));
  assert.equal(ps('Aviator AVGSR 635BK Sunglasses', 'Women', W), 'wgw | Bags & Accessories | Sunglasses');
  assert.equal(ps('Kleenex Mindfulness Collection Daydream - 3x70 pcs', 'Bathroom accessories', W), 'REJECT paper consumables');
  assert.equal(ps('Always Dailies Long - 46 pcs', 'Personal care', W), 'REJECT health, dental or hygiene product (not beauty)');
  assert.equal(ps('Always Classic Maxi 9 pcs', 'Hygiene', `${W} > Hygiene`), 'REJECT health, dental or hygiene product (not beauty)');
  assert.equal(ps('Iroha Gold Tissue Eye Patches - 2 pcs', 'Face care', `${W} > Face & skin care > Face care`), wgw('Skincare'));
});

test('Plusshop/Bazta sorting: KGW toys and baby products leave the general group for pages KGW already has', () => {
  const C = 'Children > Baby & children products';
  const A = `${C} > Activities & play time`;
  const T = `${A} > Toys`;
  const toys = sub => `kgw | Toys & Games | ${sub}`;
  assert.equal(ps('Squish Meez Cupcake Cuties Squishy Squeeze Toy - Assorted', 'Activities & play time', A), toys('Activity Toys'));
  assert.equal(ps('Pop It Fidget Toy - Yellow & Pink', 'Activities & play time', A), toys('Activity Toys'));
  assert.equal(ps('Hasbro Beyblade X Yell Kong 3-60GB – 2 Pcs', 'Activities & play time', A), toys('Activity Toys'));
  assert.equal(ps('Hot Shots Light Up Yo Yo Toy', 'Activities & play time', A), toys('Activity Toys'));
  assert.equal(ps('Disney Princess Tea Cup Playset With Squishy Toy – 7 cm – Assorted', 'Toys', T), toys('Activity Toys'));
  assert.equal(ps('Janod Lagoon play kitchen', 'Activities & play time', A), toys('Toy Kitchens & Play Food'));
  assert.equal(ps('Classic World Pizza Play Set - 37 pieces', 'Toys', T), toys('Toy Kitchens & Play Food'));
  assert.equal(ps('Construction Machines Toolbox - assorted', 'Activities & play time', A), toys('Toy Tools'));
  assert.equal(ps('Small EURO Play money', 'Activities & play time', A), toys('Pretend Shopping & Grocery'));
  assert.equal(ps('Teamsterz JCB Excavator – 7 Inch', 'Activities & play time', A), toys('Toy Lorries & Construction Vehicles'));
  assert.equal(ps('Teamsterz JCB Wheel Loader Truck – 7 Inch', 'Activities & play time', A), toys('Toy Lorries & Construction Vehicles'));
  assert.equal(ps('Teamsterz Light & Sound Car Transporter with 3 Cars', 'Activities & play time', A), toys('Toy Lorries & Construction Vehicles'));
  assert.equal(ps('Hot Wheels Monster Trucks Jeep Island Tours - GTJ44', 'Toys', T), toys('Toy Cars'));
  assert.equal(ps('Teamsterz Light & Sound Police Motorbike', 'Activities & play time', A), toys('Toy Motorcycles'));
  assert.equal(ps('Teamsterz Light & Sound Police Helicopter', 'Activities & play time', A), toys('Toy Helicopters'));
  assert.equal(ps('Peppa Pig Air Peppa Jet', 'Activities & play time', A), toys('Toy Aeroplanes'));
  assert.equal(ps('Teamsterz Light & Sound UK Ambulance', 'Activities & play time', A), toys('Toy Cars'));
  assert.equal(ps('How Wheels 1:64 3-Pack - Assorted', 'Toys', T), toys('Toy Cars'));
  assert.equal(ps('Rastar R/C Porsche 918 Spyder 1:24', 'Remote controlled toys', `${T} > Remote controlled toys`), toys('Remote Control Cars & Lorries'));
  assert.equal(ps('SpeedWay Electric Force Racetrack', 'Toys', T), toys('Toy Racing Car & Track Sets'));
  assert.equal(ps('Care Bears Cheer Bear – 14 Inch Knuffel', 'Activities & play time', A), toys('Stuffed Animals & Cuddly Toys'));
  assert.equal(ps('Rastar Mini RS Robot Spaceman', 'Toys', T), toys('Robotic Toys'));
  assert.equal(ps('Peppa Pig Stroller', 'Activities & play time', A), toys('Doll & Action Figure Accessories'));
  assert.equal(ps('Peppa Pig Soft Ball', 'Activities & play time', A), toys('Playground Balls'));
  assert.equal(ps('Fisher Price Little People Horse Stable Playset', 'Activities & play time', A), toys('Dolls, Playsets & Toy Figures'));
  assert.equal(ps('Paw Patrol True Metal - Marshall', 'Activities & play time', A), toys('Action & Toy Figures'));
  assert.equal(ps('HTI Boules with Carry Case – 8 pcs', 'Activities & play time', A), 'kgw | Sports & Outdoors | Outdoor Games');
  assert.equal(ps('Tiny Love 5-in-1 Walk-Behind & Ride-On Baby Walker – Blue', 'Activities & play time', A), 'kgw | Baby & Toddler | Baby Walkers & Entertainers');
  assert.equal(ps('Taf Toys Koala In Car Play Centre Seat Activity Mirror Toy', 'Traveling & leisure', `${C} > Traveling & leisure`), 'kgw | Baby & Toddler | Baby Activity Toys');
  assert.equal(ps('Fat Brain Suction Kupz Sensory Stacking Toy', 'Baby & children products', C), 'kgw | Baby & Toddler | Sorting & Stacking Toys');
  assert.equal(ps('VTech Sleepy Sloth Cot Light Projector With Melodies', 'Baby toys', `${C} > Baby toys`), 'kgw | Baby & Toddler | Night Lights & Ambient Lighting');
  assert.equal(ps('VTech 3-in-1 Starry Skies Sheep Soother Projector With Melodies', 'Baby toys', `${C} > Baby toys`), 'kgw | Baby & Toddler | Night Lights & Ambient Lighting');
  assert.equal(ps('Tommee Tippee Groclock Sleep Trainer Clock', 'Toys', T), 'kgw | Baby & Toddler | Night Lights & Ambient Lighting');
  assert.equal(ps('myFirst iPad Cover', 'Remote controlled toys', `${T} > Remote controlled toys`), 'kgw | Kids Tech | PDA Cases');
  assert.equal(ps('DANPOL Buckwheat Mattress 120x60cm Assorted - Boy', 'Furnitures', `${C} > Decor & children's room > Furnitures`), 'kgw | Baby & Toddler | Cot & Toddler Bed Accessories');
  assert.equal(ps('Mothercare Mosquito Net For Crib', "Decor & children's room", `${C} > Decor & children's room`), 'kgw | Baby & Toddler | Cot & Toddler Bed Accessories');
  assert.equal(ps('Relec Mosquito Repellent for Children - 100ml', 'Bathroom & care', `${C} > Bathroom & care`), 'kgw | Baby & Toddler | Baby Health');
  assert.equal(ps('Paw Patrol Blue Party Stickers 6 Sheets', 'Activities & play time', `${C} > Decor & children's room`), toys('Toy Craft Kits'));
});

// A small Plusshop-like feed: the same product in two feeds (one link with "?gsnp"), a 29p card, a lubricant.
const PS_HEAD = 'merchant_product_id,product_name,brand_name,search_price,in_stock,stock_quantity,merchant_category,category_name,merchant_product_category_path,product_gtin,merchant_deep_link,merchant_image_url\n';
const psRow = (id, name, price, leaf, path, link, ean = '') =>
  `${id},"${name}",Brand,${price},1,4,"${leaf}",,"${path}",${ean},${link},https://uk.plusshop.com/media/catalog/product/${id}.png\n`;

test('Plusshop plan: one card for the same product in two feeds, the shop address without "?gsnp", 29p and adult products out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'plusshop-'));
  writeFileSync(join(dir, 'AWIN_69306_89999.csv.gz'), gzipSync(PS_HEAD
    + psRow('A1', 'Hugo Boss Dark Blue Eau de Toilette 75ml', 29.99, 'Personal Care', 'Men > Personal Care > Fragrances > Eau de toilette', 'https://uk.plusshop.com/hugo-boss-dark-blue-eau-de-toilette-75ml?gsnp', '0737052031415')
    + psRow('A2', 'Giftmaker Christmas card - Let it Snow', 0.29, 'Christmas', 'Home > Household > Christmas > Christmas cards & gift wrap', 'https://uk.plusshop.com/giftmaker-christmas-card-let-it-snow?gsnp')
    + psRow('A3', 'Pjur Analyse Me! Lubricant - 100ml', 7.49, 'Cream, gel & oils', 'Men > Women > Personal care > Personal Care > Intimate > Cream, gel & oils', 'https://uk.plusshop.com/pjur-analyse-me-glidecreme-100ml?gsnp')));
  writeFileSync(join(dir, 'AWIN_69306_111951.csv.gz'), gzipSync(PS_HEAD
    + psRow('B1', 'Hugo Boss Dark Blue Eau de Toilette 75ml', 27.49, 'Personal Care', 'Men > Personal Care > Fragrances > Eau de toilette', 'https://uk.plusshop.com/hugo-boss-dark-blue-eau-de-toilette-75ml', '0737052031415')
    + psRow('B2', 'Ariel Liquid Colour Detergent - 1L', 6.95, 'Clean, iron & dry', 'Home > Household > Clean, iron & dry > Laundry > Detergent', 'https://uk.plusshop.com/ariel-liquid-colour-detergent-1l')
    + psRow('B3', 'Mega Bloks GRV37 Construction site', 9.30, 'Toys', 'Children > Baby & children products > Activities & play time > Toys > Building & construction toys', 'https://uk.plusshop.com/mega-bloks-grv37-construction-site')));
  const out = mkdtempSync(join(tmpdir(), 'plusshop-out-'));
  const r = await planLegacyImport({ archive: dir, retailer: 'plusshop', outDir: out, now: new Date('2026-10-23T22:30:00Z') });
  assert.equal(r.products, 5, 'the perfume in both feeds is one product');
  assert.equal(r.accepted.mgw.length, 1);
  const perfume = r.accepted.mgw[0];
  assert.equal(perfume.awin_product_id, '69306:hugo-boss-dark-blue-eau-de-toilette-75ml');
  assert.equal(perfume.merchant_product_id, 'hugo-boss-dark-blue-eau-de-toilette-75ml');
  assert.equal(perfume.price, 27.49, 'the lower in-stock price of the two feeds');
  assert.equal(perfume.ean, '0737052031415');
  assert.match(perfume.affiliate_url, /awinmid=69306&awinaffid=3057233&ued=https%3A%2F%2Fuk\.plusshop\.com%2Fhugo-boss-dark-blue-eau-de-toilette-75ml$/);
  assert.equal(r.accepted.hgw[0].subcategory, 'Laundry Detergent');
  assert.equal(r.accepted.kgw[0].merchant_product_id, 'mega-bloks-grv37-construction-site', 'KGW: the stable key is the shop address');
  assert.deepEqual(Object.keys(r.rejected).sort(), ['adult product', 'price under £1 (too small to list)']);
  assert.equal(r.accepted.wgw.length + r.accepted.ggw.length, 0);
  const plan = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
  assert.equal(plan.addOnly, false);
  assert.equal(plan.retailer, 'Plusshop UK');
  // Bazta: the same rules, its own shop and Awin number.
  assert.equal(bazta.RULES.retailer, 'Bazta UK');
  assert.ok(bazta.RULES.shop.test('https://uk.bazta.com/ariel-liquid-colour-detergent-1l'));
  assert.ok(!bazta.RULES.shop.test('https://uk.plusshop.com/ariel-liquid-colour-detergent-1l'));
});

// A fake shop: its live catalogue (/products.json) has these products (L39).
const liveShop = products => async url => ({ ok: true, json: async () => ({ products: /[?&]page=1$/.test(url) ? products : [] }) });
const VIA_HEAD = 'merchant_product_id,product_name,brand_name,search_price,currency,in_stock,stock_quantity,merchant_category,ean,merchant_deep_link,merchant_image_url\n';
const viaRow = (variant, name, price, handle) =>
  `${variant},"${name}",adidas,${price},GBP,1,1,General Clothing,,https://viaductclothing.co.uk/products/${handle}?variant=${variant},https://cdn.shopify.com/s/files/1/0300/6631/1261/files/${handle}.jpg\n`;
const viaLive = (handle, type, tags, variants) => ({ handle, product_type: type, tags, variants: variants.map(([id, available]) => ({ id, sku: '', available, featured_image: null })),
  images: [{ src: `https://cdn.shopify.com/s/files/1/0300/6631/1261/files/${handle}-live.jpg`, variant_ids: [] }] });

test('Viaduct: one card per product (all sizes), the shop tags decide men or women, juniors to KGW, the link opens the page', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'viaduct-'));
  writeFileSync(join(dir, 'AWIN_125096_114294.csv.gz'), gzipSync(VIA_HEAD
    + viaRow(11, 'adidas FC Schalke 04 3rd Kit Shorts - Green | Size: S', 7.99, 'adidas-fc-schalke-04-3rd-kit-shorts-green')
    + viaRow(12, 'adidas FC Schalke 04 3rd Kit Shorts - Green | Size: M', 7.99, 'adidas-fc-schalke-04-3rd-kit-shorts-green')
    + viaRow(21, 'New Balance Womens Energize Tights - Navy | Size: S', 39.99, 'new-balance-womens-energize-tights-navy')
    + viaRow(31, 'adidas Junior Pureboost Go Running Shoes - White | Size: 4', 44.99, 'adidas-junior-pureboost-go-white')
    + viaRow(41, 'adidas Unisex Ultra Boost DNA Shoes - Black | Size: 6', 69.99, 'adidas-unisex-ultra-boost-dna-black')));
  const fetchImpl = liveShop([
    viaLive('adidas-fc-schalke-04-3rd-kit-shorts-green', 'Shorts', ["Men's", 'Colour_Green'], [[11, true], [12, true]]),
    viaLive('new-balance-womens-energize-tights-navy', 'Leggings', ['Womens'], [[21, true]]),
    viaLive('adidas-junior-pureboost-go-white', 'Trainers', ["Men's"], [[31, true]]),
    viaLive('adidas-unisex-ultra-boost-dna-black', 'Trainers', ["Men's", 'Womens'], [[41, true]])
  ]);
  const men = await planLegacyImport({ archive: dir, retailer: 'viaduct', outDir: mkdtempSync(join(tmpdir(), 'viaduct-out-')), now: new Date('2026-10-23T22:30:00Z'), fetchImpl });
  assert.equal(men.products, 4, 'two sizes of the shorts are one product');
  assert.deepEqual(men.accepted.mgw.map(p => `${p.product_name} | ${p.site_category} | ${p.subcategory}`).sort(), [
    'adidas FC Schalke 04 3rd Kit Shorts - Green | Clothing | Shorts',
    'adidas Unisex Ultra Boost DNA Shoes - Black | Shoes | Trainers'
  ]);
  const shorts = men.accepted.mgw.find(p => /Schalke/.test(p.product_name));
  assert.equal(shorts.awin_product_id, '125096:adidas-fc-schalke-04-3rd-kit-shorts-green');
  assert.match(shorts.affiliate_url, /ued=https%3A%2F%2Fviaductclothing\.co\.uk%2Fproducts%2Fadidas-fc-schalke-04-3rd-kit-shorts-green$/, 'no ?variant=: the card covers all sizes');
  assert.equal(shorts.image_url, 'https://cdn.shopify.com/s/files/1/0300/6631/1261/files/adidas-fc-schalke-04-3rd-kit-shorts-green-live.jpg');
  assert.deepEqual(men.accepted.kgw.map(p => `${p.product_name} | ${p.site_category} | ${p.subcategory} | ${p.merchant_product_id}`), [
    'adidas Junior Pureboost Go Running Shoes - White | Shoes | Trainers | adidas-junior-pureboost-go-white'
  ]);
  assert.deepEqual(Object.keys(men.rejected), ["women's (on Women's Gear World, viaduct-women)"]);
  const women = await planLegacyImport({ archive: dir, retailer: 'viaduct-women', outDir: mkdtempSync(join(tmpdir(), 'viaduct-w-out-')), now: new Date('2026-10-23T22:30:00Z'), fetchImpl });
  assert.deepEqual(women.accepted.wgw.map(p => `${p.product_name} | ${p.site_category} | ${p.subcategory}`).sort(), [
    'New Balance Womens Energize Tights - Navy | Clothing | Leggings',
    'adidas Unisex Ultra Boost DNA Shoes - Black | Shoes | Trainers'
  ]);
  assert.equal(viaduct.displayName('adidas Originals Daily Chino Shorts - Beige | Size: XS'), 'adidas Originals Daily Chino Shorts - Beige');
  assert.equal(viaductWomen.RULES.sites.join(), 'wgw');
  // Dry run of 23 Oct 2026: a women's "Baby Tee" went to Kids' Gear World, and tracksuit bottoms were "Tracksuits".
  const babyTee = { name: "adidas Originals Women's 3-Stripes Baby Tee - Mineral Green | Size: XL", shopType: 'T-Shirts', shopTags: ['Womens'] };
  assert.deepEqual(viaduct.classify(babyTee), { reject: "women's (on Women's Gear World, viaduct-women)" });
  assert.deepEqual(viaductWomen.classify(babyTee), { site: 'wgw', siteCategory: 'Clothing', subcategory: 'T-Shirts' });
  assert.equal(viaduct.classify({ name: 'adidas Originals Tolima-02 Tracksuit Bottoms - Black / Silver | Size: M', shopType: 'Track Pants', shopTags: ["Men's"] }).subcategory, 'Trousers');
  assert.equal(viaduct.classify({ name: 'adidas Originals Adicolor Classics Adibreak Tracksuit Bottoms - Red | Size: L', shopTags: ["Men's"] }).subcategory, 'Trousers');
  assert.equal(viaduct.classify({ name: 'Nike Air Full Zip Fleece Varsity Tracksuit - Navy | Size: M', shopTags: ["Men's"] }).subcategory, 'Tracksuits');
  assert.equal(viaduct.classify({ name: 'adidas Junior Pureboost Go Running Shoes - White Ash Pearl | Size: 6.5', shopTags: ["Men's"] }).site, 'kgw');
});

test('viaduct-sizes clean-up: hides the old one-card-per-size rows only when the new cards are on the site', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL UNIQUE, retailer TEXT NOT NULL,
    site_category TEXT, product_name TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT)`);
  const add = db.prepare('INSERT INTO products (awin_product_id, retailer, site_category, product_name, is_active) VALUES (?, ?, ?, ?, ?)');
  add.run('125096:42550014705757', 'Viaduct Clothing', 'Clothing', 'Ellesse Diveria Sweatshirt - Black / S', 1);
  add.run('125096:42550014672989', 'Viaduct Clothing', 'Clothing', 'Ellesse Diveria Sweatshirt - Black / XS', 1);
  add.run('125096:40992138264669', 'Viaduct Clothing', 'Shoes', 'Reebok Victory G Gore-Tex Shoes - Grey / 4', 0);
  add.run('61655:55306556440958', 'Back to the Office', 'Watches', 'Other shop', 1);
  for (const f of ['summarySql', 'samplesSql', 'idsSql', 'keptSql']) assert.doesNotMatch(sizes[f](), /[%<>&|^]/, f);
  // No new cards yet (the import did not run): nothing to hide.
  assert.deepEqual(db.prepare(sizes.idsSql()).all(), []);
  for (let i = 0; i < 30; i++) add.run(`125096:product-page-${i}`, 'Viaduct Clothing', 'Clothing', `Product ${i}`, 1);
  const ids = db.prepare(sizes.idsSql()).all().map(r => r.id);
  assert.deepEqual(ids, [1, 2]);
  db.exec(sizes.updateSql(ids, false));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND retailer = 'Viaduct Clothing'").get().n, 30);
  db.exec(sizes.updateSql(ids, true));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND retailer = 'Viaduct Clothing'").get().n, 32);
});

test('Beyond Shakers: shakers and bottles to HGW Kitchen & Dining with a name that says what they are; supplements out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'shakers-'));
  const head = 'merchant_product_id,product_name,brand_name,search_price,merchant_category,ean,merchant_deep_link,merchant_image_url\n';
  const row = (v, name, price, handle) => `${v},"${name}",Beyond Shakers,${price},Fitness Equipment,,https://beyondshakers.com/products/${handle}?variant=${v},https://beyondshakers.com/cdn/shop/files/${handle}.jpg\n`;
  writeFileSync(join(dir, 'AWIN_66912_98325.csv.gz'), gzipSync(head + row(1, 'Terracotta & Sand Twist', 24.99, 'twist-shaker-terracotta-sand') + row(2, 'Pink', 19.99, 'pink')));
  writeFileSync(join(dir, 'AWIN_66912_118469.csv.gz'), gzipSync(head + row(3, 'Grey Gym Towel', 10, 'grey-gym-towel') + row(4, 'Creatine Gummies', 24.99, 'creatine-gummies')));
  const fetchImpl = liveShop([['twist-shaker-terracotta-sand', 'Shaker', 1], ['pink', 'Shaker', 2], ['grey-gym-towel', 'Towels', 3], ['creatine-gummies', 'Supplement', 4]]
    .map(([handle, type, id]) => ({ handle, product_type: type, tags: [], variants: [{ id, sku: '', available: true }], images: [{ src: `https://beyondshakers.com/cdn/shop/files/${handle}.jpg`, variant_ids: [] }] })));
  const r = await planLegacyImport({ archive: dir, retailer: 'beyondshakers', outDir: mkdtempSync(join(tmpdir(), 'shakers-out-')), now: new Date('2026-10-23T22:30:00Z'), fetchImpl });
  assert.deepEqual(r.accepted.hgw.map(p => `${p.product_name} | ${p.site_category} | ${p.subcategory}`).sort(), [
    'Beyond Shakers Grey Gym Towel | Bedding & Bath | Towel',
    'Beyond Shakers Pink Protein Shaker | Kitchen & Dining | Drinkware',
    'Beyond Shakers Terracotta & Sand Twist Protein Shaker | Kitchen & Dining | Drinkware'
  ]);
  assert.deepEqual(Object.keys(r.rejected), ['supplements, lifting gear or gift cards (not on these sites)']);
  assert.equal(shakers.RULES.sites.join(), 'hgw');
  // A name that already says "Beyond" gets no second "Beyond Shakers" (dry run of 23 Oct 2026).
  assert.equal(shakers.classify({ name: 'Brushed Steel Beyond Stainless Steel Protein Shaker', shopType: 'Shaker' }).name, 'Brushed Steel Beyond Stainless Steel Protein Shaker');
  assert.equal(shakers.classify({ name: 'Lilac Beyond Water Bottle 1L Capacity', shopType: 'Bottle' }).name, 'Lilac Beyond Water Bottle 1L Capacity');
});
