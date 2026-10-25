#!/usr/bin/env node
// Sports feed scan. READ-ONLY: reads the Awin feed files on this PC (and, if given, a copy of the Awin feed list)
// and writes a report. It imports nothing and changes no file.
// For the planned Sporty Gear World site (sportygearworld.com, proposed code SGW).
//
// 1. Feeds on this PC, in one or more folders (AWIN_<advertiserId>_<feedId>.csv[.gz] and Google Shopping files
//    "<advertiserId>-<name>.csv[.gz]"). When the same file is in two folders, the newest copy counts (L41).
//    Per retailer: how many DIFFERENT sport products (Google files: all sizes of a product are one product, L34),
//    per proposed category, in stock, currencies, top shop categories and samples.
// 2. Products that belong to (or would also show on) another Gear World site are counted apart, so the owner can
//    decide the "yes" and "no" rules (L14) before any import: kids (KGW), swimwear (MGW/WGW), smartwatches and
//    trackers (TGW or SGW: owner's decision), trainers with no sport word (sport or fashion: owner's decision),
//    car racks (AGW), pools and trampolines (GGW). Products that also fit the real VGW, AGW or TGW rules stay SGW
//    products and are flagged. Owner (25 Oct 2026): anything to do with sport belongs on SGW, with sports shoes,
//    gym, supplements and all fitness.
// 3. Awin feed list (optional, --list <csv>): which programmes look like sports retailers, joined or not, with the
//    link to apply. Tickets, betting, gym memberships and holidays are left out (no products to show).
//
// Usage: node tools/sports-feed-scan.mjs --archive <dir>[;<dir>...] --out <dir> [--list <feed list csv>] [--max-rows <n per feed>]
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords, googleBaseName } from './tgw-import-plan.mjs';
import * as TGW_RULES from '../sites/tgw/category-rules.js';
import * as AGW_RULES from '../sites/agw/category-rules.js';
import * as VGW_RULES from '../sites/vgw/category-rules.js';

// A list of regex fragments -> one regex with word edges (L42: "gin" must not match "Original").
const words = list => new RegExp(`(?<![a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// Words that say "this is about sport". The shop's own category counts too.
export const SPORT_CTX = words(['sports?', 'sporting', 'gym', 'fitness', 'workouts?', 'training', 'exercises?', 'athletic', 'athletics',
  'running', 'runners?', 'jogging', 'cycling', 'cyclists?', 'bikes?', 'bicycles?', 'football', 'soccer', 'rugby', 'cricket', 'hockey',
  'basketball', 'netball', 'volleyball', 'tennis', 'badminton', 'squash', 'padel', 'pickleball', 'golf', 'yoga', 'pilates', 'crossfit',
  'boxing', 'mma', 'martial arts', 'karate', 'judo', 'taekwondo', 'kickboxing', 'swim', 'swimming', 'swimmers?', 'triathlon', 'marathon',
  'ski', 'skiing', 'snowboard(?:ing)?', 'hiking', 'trekking', 'climbing', 'bouldering', 'kayak(?:ing)?', 'surf(?:ing)?', 'paddle ?board(?:ing)?',
  'weightlifting', 'bodybuilding', 'powerlifting', 'cardio', 'hiit', 'outdoor sports?', 'team sports?', 'skate ?board(?:ing)?', 'fishing', 'angling']);
// A shop category that says sport ("Sports & Outdoors > Fitness", "Cycling > Parts").
export const SPORT_SHOP = words(['sports?', 'sporting goods', 'sportswear', 'fitness', 'gym', 'exercise', 'athletic', 'cycling', 'bikes?',
  'bicycles?', 'running', 'football', 'tennis', 'golf', 'swimming', 'water sports?', 'watersports', 'ski(?:ing)?', 'snow sports?',
  'outdoor recreation', 'yoga', 'boxing', 'martial arts', 'climbing', 'fishing', 'angling', 'team sports?', 'racket sports?', 'activewear']);

// Not sport products, even with a sport word (L42: "Bicycle" playing cards; tennis jewellery; video games; decor).
export const NO = words(['bicycle (?:playing )?cards?', 'playing cards?', 'tennis (?:bracelets?|necklaces?|chains?|earrings?)',
  'table runners?', 'carpet runners?', 'stair runners?', 'rug runners?', 'drawer runners?', 'runner beans?', 'bean seeds?',
  'video games?', 'ps4', 'ps5', 'playstation', 'xbox', 'nintendo', 'switch 2', 'fifa', 'ea sports fc', 'pc game', 'game key',
  'books?', 'paperback', 'hardback', 'novel', 'posters?', 'wall art', 'canvas prints?', 'framed prints?', 'stickers?', 'decals?',
  'mugs?', 'keyrings?', 'key chains?', 'fridge magnets?', 'greeting cards?', 'gift cards?', 'vouchers?', 'costumes?', 'fancy dress',
  'party', 'balloons?', 'cake toppers?', 'birthday', 'bedding', 'duvet(?: cover)?s?', 'pillowcases?', 'curtains?', 'wallpaper',
  'phone cases?', 'iphone cases?', 'lego', 'action figures?', 'figurines?', 'jigsaw', 'puzzles?', 'dogs?', 'cats?', 'pets?', 'puppy',
  'horse ?(?:rugs?|feeds?|treats?)', 'perfumes?', 'eau de (?:toilette|parfum)', 'aftershave', 'motorbikes?', 'motorcycles?',
  'motocross', 'mopeds?', 'quad bikes?', 'dirt bikes?', 'pit bikes?', 'motorbike helmets?', 'motorcycle helmets?', 'sewing machines?',
  'fuser', 'toner', 'printer', 'cartridges?', 'running boards?', '(?:daytime )?running lights?', 'running water', 'runner rugs?', 'running-in',
  'vw golf', 'volkswagen golf', 'golf (?:gti|gtd|gte|mk ?[1-8]|r32|tdi|tsi|estate|hatchback)', 'boxing day', 'stepper motors?', 'stepper drivers?']);

// Proposed SGW categories (first match wins; "ctx" words count only with a sport word or a sport shop category).
// "scan" = a scan-only group, shown so the owner can decide if it becomes a category or joins another one.
export const CATEGORIES = [
  {
    key: 'fitness-gym', label: 'Fitness & Gym',
    sure: words(['dumbbells?', 'kettlebells?', 'barbells?', '(?:weight|bumper|olympic|disc) plates?', 'olympic bars?', 'ez ?(?:curl )?bars?',
      '(?:weights?|gym|workout|adjustable|flat|incline|utility|sit ?up|ab|preacher) benches', '(?:weights?|gym|workout|adjustable|flat|incline|utility|sit ?up|ab|preacher) bench',
      'power (?:racks?|cages?|towers?)', 'squat (?:racks?|stands?)', 'smith machines?', 'cable (?:machines?|crossovers?)', 'multi ?gyms?', 'home gyms?',
      'resistance bands?', 'loop bands?', 'booty bands?', 'pull ?ups? bars?', 'chin ?ups? bars?', 'dip (?:stations?|bars?|stands?)', 'push ?ups? (?:bars?|boards?|handles?)',
      'ab (?:rollers?|wheels?)', 'foam rollers?', 'massage guns?', 'yoga (?:mats?|blocks?|bricks?|straps?|wheels?|bolsters?)', 'pilates (?:rings?|balls?|reformers?|bars?)',
      '(?:exercise|fitness|gym|workout|training) mats?', '(?:exercise|gym|swiss|stability|yoga|balance) balls?', '(?:medicine|slam|wall) balls?',
      'battle ropes?', 'skipping ropes?', 'jump ropes?', 'speed ropes?', 'treadmills?', 'walking pads?', 'under ?desk treadmills?',
      '(?:exercise|spin|spinning|indoor cycling|magnetic|recumbent|air) bikes?', 'rowing machines?', 'cross ?trainers?', 'elliptical(?: trainers?)?',
      '(?:mini |fitness |exercise |twist |step |side )?steppers?(?! (?:motors?|drivers?))', 'stair ?climbers?', 'vibration plates?', 'plyo(?:metric)? box(?:es)?', '(?:aerobic|fitness) steps?', 'step platforms?',
      'weighted vests?', 'weight vests?', '(?:ankle|wrist) weights?', 'hand grips?', 'grip strengtheners?', '(?:weight ?)?lifting (?:belts?|straps?|gloves?)',
      'wrist wraps?', 'knee sleeves?', 'gym gloves?', 'suspension trainers?', 'trx', 'rebounders?', 'fitness trampolines?', 'balance boards?',
      'gymnastics mats?', 'bodybuilding', 'powerlifting', 'weightlifting', 'calisthenics', 'hyperextension(?: benches?)?', 'sit ?up bars?', 'trap bars?', 'hex bars?', 'landmine', 'weight (?:sets?|racks?|trees?)']),
    ctx: words(['benches', 'bench', 'mats?', 'ropes?', 'weights?', 'bands?', 'rollers?', 'bars?', 'gloves?', 'balls?']),
    shop: words(['fitness', 'gym', 'strength training', 'weights?', 'cardio', 'yoga', 'pilates', 'exercise'])
  },
  {
    key: 'combat', label: 'Boxing & martial arts', scan: true,
    sure: words(['boxing gloves?', 'punch(?:ing)? bags?', 'boxing bags?', 'speed bags?', 'focus (?:pads?|mitts?)', 'punch mitts?', 'hand wraps?',
      'kick (?:pads?|shields?)', 'thai pads?', 'mma gloves?', 'sparring', 'gum ?shields?', 'groin guards?',
      'karate', 'judo', 'taekwondo', 'jiu ?jitsu', 'bjj', 'kickboxing', 'martial arts', 'boxing', 'mma']),
    ctx: words(['mouth ?guards?', 'head ?guards?']),
    shop: words(['boxing', 'martial arts', 'combat sports?', 'mma'])
  },
  {
    key: 'running', label: 'Running',
    sure: words(['running (?:shoes?|trainers?|jackets?|vests?|belts?|shorts|tights|tops?|socks?|caps?|gloves?|backpacks?|packs?|hats?|t-?shirts?|leggings|bottles?|lights?|headlamps?|armbands?)',
      'trail (?:running|shoes?|runners?)', 'road running', 'hydration (?:vests?|packs?)', 'race vests?', 'phone armbands?', 'running armbands?',
      'race belts?', 'number belts?', 'marathon', 'parkrun', 'running']),
    ctx: words(['armbands?', 'reflective vests?', 'hi ?vis vests?']),
    shop: words(['running', 'jogging', 'athletics', 'trail running'])
  },
  {
    key: 'cycling', label: 'Cycling',
    sure: words(['bicycles?', '(?:road|mountain|gravel|hybrid|folding|electric|commuter|city|touring|trekking|fat ?tyre|fat ?tire|cargo) bikes?', 'e-?bikes?', 'mtb',
      'bmx', 'cycl(?:e|ing) helmets?', 'bike helmets?', 'bike (?:lights?|lock|locks|pumps?|computers?|saddles?|seats?|tyres?|tires?|tubes?|chains?|bags?|baskets?|bells?|mirrors?|stands?|tools?|gloves?|shoes?|shorts|jerseys?|jackets?|glasses|mudguards?|fenders?|panniers?|trailers?|covers?|grips?|pedals?)',
      'cycling (?:jerseys?|jackets?|shorts|tights|shoes?|gloves?|glasses|sunglasses|socks?|caps?|vests?|gilets?|bibs?|computers?|helmets?|lights?|bags?|backpacks?|overshoes)',
      'bib (?:shorts|tights)', 'cycle computers?', 'inner tubes?', 'track pumps?', 'chain (?:lubes?|oil|cleaners?)', 'derailleurs?', 'chainrings?', 'cranksets?',
      'clipless pedals?', 'turbo trainers?', 'smart trainers?', 'bike trainers?', 'puncture repair(?: kits?)?', 'tubeless', 'frame bags?',
      'handlebar (?:bags?|tape|grips?)', 'saddle bags?', 'pannier(?: bags?)?s?', 'kickstands?', 'cycling', 'cyclists?']),
    ctx: words(['helmets?', 'lights?', 'locks?', 'pumps?', 'saddles?', 'pedals?', 'tyres?', 'tires?', 'tubes?', 'bells?', 'baskets?', 'mudguards?', 'cassettes?']),
    shop: words(['cycling', 'cycle', 'bikes?', 'bicycles?', 'bike (?:parts|accessories|components)'])
  },
  {
    key: 'team-sports', label: 'Football & team sports',
    sure: words(['football boots?', 'astro ?turf(?: trainers?| boots?)?', 'shin (?:pads?|guards?)', 'goal ?keeper gloves?', 'goalie gloves?',
      '(?:football|soccer|futsal|pop ?up|training|mini) goals?', 'football nets?', 'training cones?', 'agility (?:ladders?|hurdles?|poles?)',
      'rugby (?:balls?|boots?|tops?|shirts?)', 'scrum caps?', 'tackle (?:bags?|pads?|shields?)', 'basketball(?: hoops?| nets?| stands?)?', 'netball(?: posts?)?',
      'volleyball(?: nets?)?', 'handball', 'cricket (?:bats?|balls?|pads?|helmets?|gloves?|stumps?|sets?|bags?)', 'batting gloves?', 'wicket ?keeping gloves?',
      '(?:field )?hockey (?:sticks?|balls?|shin)', 'baseball (?:bats?|gloves?|mitts?|balls?)', 'softball', 'lacrosse', 'american football',
      'referee (?:whistles?|cards?|kits?)', 'tactics boards?', 'football kits?', 'footballs?', 'nfl', 'gridiron', 'american football (?:helmets?|balls?|gloves?|pads?)', 'shoulder pads? for football', 'soccer balls?', 'futsal', 'rounders', 'gaelic football', 'hurling']),
    ctx: words(['balls?', 'goals?', 'nets?', 'whistles?', 'cones?', 'bibs?']),
    shop: words(['football', 'soccer', 'rugby', 'cricket', 'basketball', 'netball', 'hockey', 'team sports?', 'volleyball', 'baseball'])
  },
  {
    key: 'racket-sports', label: 'Racket sports',
    sure: words(['tennis', 'badminton', 'shuttlecocks?', 'squash (?:rackets?|racquets?|balls?|shoes?)', 'padel', 'pickleball', 'table tennis', 'ping ?pong',
      'rackets?', 'racquets?', 'overgrips?', 'racket strings?', 'string(?:ing)? machines?']),
    ctx: words(['ball machines?', 'nets?', 'grips?']),
    shop: words(['tennis', 'badminton', 'squash', 'padel', 'racket sports?', 'racquet sports?', 'table tennis', 'pickleball'])
  },
  {
    key: 'golf', label: 'Golf', scan: true,
    sure: words(['golf', 'golfers?', 'putters?', '(?:driver|fairway|hybrid|wedge|iron) (?:head ?)?covers?', 'tee(?:s)? (?:pegs?|sets?)', 'rangefinders?', 'divot tools?']),
    shop: words(['golf'])
  },
  {
    key: 'water-sports', label: 'Water sports & swimming',
    sure: words(['kayaks?', 'canoes?', 'paddle ?boards?', 'sup boards?', 'stand ?up paddle(?: ?boards?)?', 'i?sup', 'kayak paddles?', '(?:sup|kayak|canoe) (?:paddles?|seats?|pumps?|leashes?)',
      'wetsuits?', 'shortie', 'swim(?:ming)? (?:goggles|caps?|fins|training|buoys?|bags?|paddles?|watches?|snorkels?)', 'goggles for swimming', 'kick ?boards?', 'pull buoys?',
      'diving (?:masks?|fins|computers?|knives?|torches?)', 'dive (?:masks?|computers?|fins|torches?)', 'scuba', 'bcds?', 'freediving', 'snorkel(?:ling)? (?:sets?|masks?)',
      'surf ?boards?', 'body ?boards?', 'boogie ?boards?', 'skim ?boards?', 'kite ?surf(?:ing)?', 'wind ?surf(?:ing)?', 'wake ?boards?', 'water ?skis?',
      'buoyancy aids?', 'life ?jackets?', 'rash (?:vests?|guards?)', 'water shoes?', 'aqua shoes?', 'swimrun', 'open water', 'tow floats?', 'dry ?robes?', 'changing robes?',
      'surf ponchos?', 'swimming', 'swimmers?']),
    ctx: words(['paddles?', 'fins', 'goggles', 'snorkels?', 'leashes?']),
    shop: words(['water ?sports?', 'swimming', 'swim', 'surf(?:ing)?', 'kayak(?:ing)?', 'canoe(?:ing)?', 'paddle ?boarding', 'diving', 'snorkel(?:ling)?'])
  },
  {
    key: 'winter-sports', label: 'Winter sports',
    sure: words(['skis', 'ski (?:boots?|poles?|goggles|helmets?|gloves?|jackets?|trousers|pants|socks?|bags?|masks?|wax|bindings?|suits?)', 'salopettes',
      'snowboards?', 'snowboard(?:ing)? (?:boots?|bindings?|jackets?|pants|trousers|helmets?|gloves?|goggles|bags?)', 'snow ?shoes', 'ice skates?',
      'figure skates?', 'ice hockey', 'cross ?country skis?', 'touring skis?', 'avalanche (?:beacons?|probes?|shovels?|transceivers?)', 'skiing', 'snowboarding']),
    ctx: words(['goggles', 'balaclavas?', 'neck gaiters?']),
    shop: words(['ski(?:ing)?', 'snow ?sports?', 'snowboard(?:ing)?', 'winter sports?'])
  },
  {
    key: 'outdoor-climbing', label: 'Hiking & climbing',
    sure: words(['hiking (?:boots?|shoes?|socks?|poles?|backpacks?|rucksacks?|trousers|pants|jackets?|sticks?|sandals?)', 'walking boots?', 'trekking (?:poles?|boots?|shoes?)',
      'walking poles?', 'nordic walking', 'climbing (?:harness(?:es)?|shoes?|ropes?|chalk|holds?|helmets?)', 'harness(?:es)? for climbing', 'carabiners?', 'quickdraws?',
      'belay(?: devices?)?', 'chalk bags?', 'bouldering', 'crash pads?', 'crampons?', 'ice axes?', 'via ferrata', 'mountaineering', 'approach shoes?', 'gaiters']),
    ctx: words(['hiking', 'trekking', 'climbing']),
    shop: words(['hiking', 'trekking', 'climbing', 'mountaineering', 'walking'])
  },
  {
    key: 'skate-scooter', label: 'Skateboards, skates & scooters', scan: true,
    sure: words(['skate ?boards?', 'longboards?', 'cruiser boards?', 'roller ?skates?', 'inline skates?', 'roller ?blades?', 'stunt scooters?', 'skate (?:helmets?|pads?|shoes?)']),
    shop: words(['skate(?:boarding)?', 'roller skating', 'scooters?'])
  },
  {
    key: 'fishing', label: 'Fishing', scan: true,
    sure: words(['fishing', 'angling', 'tackle box(?:es)?', 'fly tying', 'carp rods?', 'spinning rods?', 'float rods?']),
    shop: words(['fishing', 'angling'])
  },
  {
    key: 'indoor-games', label: 'Darts, snooker & table games', scan: true,
    sure: words(['dart ?boards?', 'darts', 'snooker', 'pool (?:tables?|cues?|balls?)', 'billiards?', 'table football', 'foosball', 'air hockey', 'shuffleboard']),
    shop: words(['darts', 'snooker', 'billiards', 'games room'])
  },
  {
    key: 'bags-bottles', label: 'Sports bags, bottles & nutrition accessories',
    sure: words(['protein shakers?', 'shaker (?:bottles?|cups?)', 'blender bottles?', 'gym bags?', 'kit bags?', 'sports bags?', 'boot bags?', 'sports (?:bottles?|water bottles?)',
      'gym (?:bottles?|towels?|backpacks?|duffels?|holdalls?)', 'sports towels?', 'cooling towels?', 'pill organisers? for gym', 'meal prep (?:bags?|containers?) for gym', 'hydration bladders?', 'drinks? bottles? for (?:sport|gym|cycling|running)']),
    ctx: words(['shakers?', '(?:water )?bottles?', 'holdalls?', 'duffels?', 'duffle bags?', 'drawstring bags?', 'towels?', 'backpacks?']),
    shop: words(['sports? (?:bags|accessories)', 'nutrition accessories'])
  },
  {
    // Owner (25 Oct 2026): supplements belong on SGW. Sports nutrition counts without a sport word; general
    // supplements (vitamins, collagen...) only with a sport word or in a sport shop category.
    key: 'nutrition', label: 'Sports nutrition & supplements',
    sure: words(['protein (?:powders?|bars?|shakes?|snacks?|cookies?|pancakes?|bites|crisps|puddings?|water)', 'whey(?: protein)?', 'casein', 'creatine',
      'pre-?workouts?', 'bcaas?', 'eaas?', 'amino acids?', 'mass gainers?', 'weight gainers?', 'energy (?:gels?|chews?|bars?)', 'electrolytes?',
      'isotonic', 'hydration (?:tablets?|powders?|drinks?)', 'beta-?alanine', 'glutamine', 'l-?carnitine', 'citrulline', 'sports nutrition', 'protein']),
    ctx: words(['supplements?', 'vitamins?', 'multivitamins?', 'collagen', 'omega ?3', 'fish oil', 'magnesium', 'zinc', 'capsules', 'tablets', 'gummies',
      'caffeine', 'recovery drinks?', 'joint support']),
    shop: words(['sports nutrition', 'supplements?', 'protein'])
  },
  {
    key: 'sportswear-shoes', label: 'Sportswear & sports shoes',
    sure: words(['sports? bras?', 'gym (?:leggings|shorts|tops?|t-?shirts?|vests?|wear|hoodies?|joggers)', 'workout (?:leggings|shorts|tops?|clothes|wear|sets?)',
      'training (?:shoes?|trainers?|tops?|t-?shirts?|shorts|pants|jackets?|tights|jerseys?|bibs?)', 'compression (?:tops?|shirts?|shorts|tights|leggings|sleeves?|socks?)',
      'base ?layers?', 'thermal base layers?', 'track ?suits?', 'track (?:pants|tops?|jackets?)', 'activewear', 'sportswear', 'athletic (?:shorts|shoes?|socks?|wear)',
      'sports (?:shorts|tops?|t-?shirts?|socks?|shoes?|leggings|jackets?|vests?|caps?)', 'performance (?:t-?shirts?|tees?|tops?|socks?|shorts)', 'cross ?training shoes?',
      'indoor court shoes?', 'spikes for (?:athletics|running)', 'athletics spikes',
      '(?:nike|adidas|asics|new balance|puma|reebok|under armour|hoka|salomon|brooks|saucony|mizuno|on running|altra|inov-?8|merrell|la sportiva|scarpa|karrimor|umbro|kappa|diadora|joma|lonsdale|everlast)[^|]{0,60}(?:trainers?|sneakers?|running shoes?|sports shoes?|gym shoes?|training shoes?)']),
    ctx: words(['leggings', 'joggers', 'trainers?', 'shorts', 'socks?', 'hoodies?', 'jackets?', 'vests?', 'tops?', 't-?shirts?', 'caps?', 'headbands?', 'sweatbands?', 'wristbands?']),
    shop: words(['sportswear', 'activewear', 'sports? (?:clothing|shoes|footwear|apparel)', 'athletic (?:clothing|shoes|footwear)'])
  }
];
export const OTHER = { key: 'other-sport', label: 'Other sport products' };

// Products that go to (or would also show on) another Gear World site. Checked in this order, before the sport category.
export const OVERLAPS = [
  { key: 'kids', label: 'Kids (Kids\' Gear World, KGW)', re: words(["kids?", "kid's", 'children', "children's", 'childrens', 'child', "child's", 'childs', 'junior', 'juniors', 'jnr',
    'boys?', "boy's", 'girls?', "girl's", 'toddlers?', 'baby', 'babies', 'infants?', 'youth', 'balance bikes?', 'trikes?', 'tricycles?', 'stabilisers?',
    '(?:12|14|16|18) ?(?:inch|in|") (?:wheels? )?bikes?', 'toys?', 'paddling pools?', 'play ?houses?', 'play ?sets?', 'swing sets?']) },
  { key: 'swimwear', label: 'Swimwear and fashion (Men\'s / Women\'s Gear World)', re: words(['bikinis?', 'swimsuits?', 'swimming costumes?', 'swim (?:shorts|trunks|dress(?:es)?|briefs)',
    'board ?shorts', 'tankinis?', 'beach ?wear', 'swimwear', 'kaftans?', 'sarongs?']), unless: words(['competition', 'racing', 'training', 'chlorine resistant', 'endurance', 'jammers?']) },
  { key: 'watch', always: true, label: 'Smartwatches & fitness trackers (decide: TGW or SGW)', re: words(['smart ?watch(?:es)?', 'fitness (?:trackers?|bands?|watch(?:es)?)', 'activity (?:trackers?|bands?)',
    'gps (?:sports? )?watch(?:es)?', 'sports? watch(?:es)?', 'running watch(?:es)?', 'multisport watch(?:es)?', 'heart rate (?:monitors?|straps?|sensors?)', 'hrm',
    'garmin (?:forerunner|fenix|f[eē]nix|venu|vivoactive|vivosmart|vivomove|instinct|epix|enduro|approach|lily|bounce)', 'fitbit', 'apple watch', 'galaxy watch', 'pixel watch',
    'polar (?:vantage|grit|pacer|ignite|unite|verity|h10|h9)', 'coros', 'amazfit', 'whoop', 'suunto', 'wahoo elemnt rival', 'smart rings?', 'oura']) },
  { key: 'trainers', always: true, noCat: true, label: 'Trainers & sneakers with no sport word or sports brand (sport or fashion? decide)', re: words(['trainers?', 'sneakers?']),
    unless: words(['personal trainers?', 'turbo trainers?', 'smart trainers?', 'bike trainers?', 'cross ?trainers?', 'suspension trainers?', 'potty trainers?', 'toilet trainers?', 'trainer (?:cups?|pants|seats?)']) },
  { key: 'car', label: 'Car racks and carriers (Car Gear World, AGW)', re: words(['(?:bike|cycle|bicycle|ski|snowboard|kayak|canoe|sup|surf ?board) (?:racks?|carriers?|mounts?|holders?) for (?:cars?|vehicles?|suvs?|vans?|tow ?bars?|towbars?)',
    'tow ?bar (?:bike|cycle) (?:racks?|carriers?)', 'towbar (?:bike|cycle) (?:racks?|carriers?)', '(?:roof|rear|boot|hitch|tailgate|spare wheel) (?:mounted )?(?:bike|cycle|ski|kayak) (?:racks?|carriers?)',
    '(?:bike|cycle|ski|kayak) (?:racks?|carriers?) (?:roof|rear|boot|hitch|tow ?bar|towbar|tailgate)', 'roof (?:bars?|racks?|boxes?)', 'tow ?bars?', 'towbars?', 'car (?:seat covers?|boot liners?)']) },
  { key: 'garden', label: 'Pools, hot tubs and trampolines (Garden Gear World, GGW)', re: words(['trampolines?', '(?:swimming|above ground|frame|garden|inflatable|family) pools?',
    'pool (?:covers?|pumps?|ladders?|filters?|heaters?|chemicals?|chlorine|liners?|vacuums?|cleaners?|floats?|lounger)', 'hot tubs?', 'spa (?:pools?|covers?)', 'lazy ?spa', 'garden games?',
    'swing seats?', 'garden swings?']), unless: words(['fitness trampolines?', 'rebounders?', 'mini trampolines? for (?:fitness|exercise|workout)', 'swimming pool (?:goggles|toys)']) }
];
const KIDS = OVERLAPS[0];
// Checked with the real rules of the other new sites, only for products that matched an SGW category.
export const SITE_RULES = [
  { key: 'vgw', label: 'Also matches the Travel Gear World rules (VGW)', rules: VGW_RULES },
  { key: 'agw', label: 'Also matches the Car Gear World rules (AGW)', rules: AGW_RULES },
  { key: 'tgw', label: 'Also matches the Technology Gear World rules (TGW)', rules: TGW_RULES }
];
const OVERLAP_KEYS = OVERLAPS.map(o => o.key);
const ALSO_KEYS = SITE_RULES.map(s => s.key);
const overlapLabel = k => (OVERLAPS.find(o => o.key === k) || SITE_RULES.find(s => s.key === k) || { label: k }).label;

// Words in a programme's name that point to a sports retailer (for the Awin list).
export const PROGRAMME_WORDS = words(['sports?', 'sporting', 'sportswear', 'fitness', 'gym', 'gymshark', 'running', 'runners?', 'run', 'cycl(?:e|es|ing|ist)', 'bikes?',
  'bicycles?', 'golf', 'tennis', 'padel', 'badminton', 'football', 'soccer', 'rugby', 'cricket', 'hockey', 'swim(?:ming|wear)?', 'ski(?:ing)?', 'snow(?:board)?',
  'surf', 'outdoors?', 'yoga', 'pilates', 'boxing', 'martial', 'climbing', 'kayaks?', 'paddle', 'sup', 'triathlon', 'athletic', 'athletics', 'protein',
  'nutrition', 'decathlon', 'wiggle', 'chain reaction', 'sweaty betty', 'under armour', 'puma', 'adidas', 'nike', 'asics', 'new balance', 'reebok', 'salomon',
  'hoka', 'garmin', 'wahoo', 'lululemon', 'castore', 'myprotein', 'pro:?direct', 'prodirect', 'lovell', 'mountain', 'trail', 'fishing', 'angling', 'darts',
  'equestrian', 'skate', 'scooters?', 'trampolines?', 'weights', 'dumbbells?', 'kettlebells?', 'treadmills?']);
// Programmes that sell tickets, bets, memberships or trips, not products: left out of the list.
export const PROGRAMME_NO = words(['tickets?', 'betting', 'bet', 'bets', 'casino', 'bingo', 'lottery', 'lotto', 'poker', 'memberships?', 'gym pass', 'streaming',
  'tv', 'holidays?', 'hotels?', 'flights?', 'tours?', 'insurance', 'fantasy', 'magazines?', 'subscriptions?', 'events?', 'courses?', 'academy', 'coaching app']);

export function isSportProgramme(name, vertical = '') {
  const t = String(name || '');
  if (PROGRAMME_NO.test(t)) return false;
  return PROGRAMME_WORDS.test(t) || /sport|fitness/i.test(String(vertical || ''));
}

const low = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[’`]/g, "'").replace(/[ \s]+/g, ' ').trim();

// name: product name; shopCat: the shop's category and Awin's category. Returns
//   { sport: true, cat }                         a product for SGW
//   { sport: true, cat, also }                   a product for SGW that also fits the rules of VGW, AGW or TGW
//   { sport: false, overlap, cat }               a sport product that belongs to another site
//   { sport: false }                             not a sport product
export function classify(name, shopCat = '') {
  const n = low(name), c = low(shopCat);
  if (!n || NO.test(n)) return { sport: false, why: 'no-list' };
  const sportShop = SPORT_SHOP.test(c);
  const ctx = SPORT_CTX.test(n) || sportShop;
  // First the clear names of every category, then the general words (so "golf balls" is golf, not a gym ball).
  let cat = null;
  for (const k of CATEGORIES) if (k.sure.test(n)) { cat = k.key; break; }
  if (!cat && ctx) for (const k of CATEGORIES) if (k.ctx && k.ctx.test(n)) { cat = k.key; break; }
  // Second chance: the shop's own sport category says which one ("Sports > Cycling > Accessories").
  if (!cat && sportShop) for (const k of CATEGORIES) if (k.shop && k.shop.test(c)) { cat = k.key; break; }
  if (!cat && sportShop && SPORT_CTX.test(n)) cat = OTHER.key;
  // "always" groups (smartwatches) are counted even without a sport word, for the owner's TGW-or-SGW decision.
  for (const o of OVERLAPS) {
    if (!o.always && !cat && !ctx) continue;
    if (o.noCat && cat) continue;
    if (o.re.test(n) && !(o.unless && o.unless.test(n))) {
      // Kids' products go to KGW first, also in the groups counted without a sport word (kids' trainers, kids' smartwatches).
      if (o.key !== KIDS.key && KIDS.re.test(n)) return { sport: false, overlap: KIDS.key, cat };
      return { sport: false, overlap: o.key, cat };
    }
  }
  if (!cat) return { sport: false };
  // Owner (25 Oct 2026): anything to do with sport belongs on SGW (hiking, kayak, basketball, tennis, NFL, rugby,
  // bodybuilding). A product that also fits the rules of VGW, AGW or TGW stays an SGW product and is only flagged,
  // so the yes/no rules (L14) can decide which site shows it.
  for (const s of SITE_RULES) {
    let ok = false;
    try { ok = !!s.rules.classify(name, shopCat, shopCat).ok; } catch { ok = false; }
    if (ok) return { sport: true, cat, also: s.key };
  }
  return { sport: true, cat };
}

// ---------- Reading the feeds ----------

const AWIN_COLS = {
  merchant: ['merchant_name'], name: ['product_name'], desc: ['product_short_description'],
  price: ['search_price', 'store_price', 'display_price', 'price'], currency: ['currency'],
  qty: ['stock_quantity'], flag: ['in_stock', 'is_for_sale', 'stock_status'],
  shopCat: ['merchant_category', 'merchant_product_category_path'], awinCat: ['category_name'], brand: ['brand_name']
};
const GOOGLE_COLS = {
  merchant: [], name: ['title'], desc: ['description'], price: ['sale_price', 'price'], currency: [], qty: [], flag: ['availability'],
  shopCat: ['product_type'], awinCat: ['google_product_category'], brand: ['brand']
};
function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  const google = !h.includes('product_name') && h.includes('title') && (h.includes('link') || h.includes('id'));
  const cols = google ? GOOGLE_COLS : AWIN_COLS;
  return { google, ...Object.fromEntries(Object.entries(cols).map(([k, names]) => [k, names.map(x => h.indexOf(x)).filter(i => i >= 0)])) };
}
const pick = (rec, idxs) => { for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); } return ''; };

// In stock: a quantity number wins (L64: "in stock" with quantity 0 is out of stock), else the flag (L37).
export function inStock(qty, flag) {
  const q = String(qty || '').trim();
  if (/^\d+(\.0+)?$/.test(q)) return Number(q) > 0;
  const s = String(flag || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  if (/^(yes|y|true|in_stock|instock|available|available_to_order|limited_stock|preorder|backorder)$/.test(s)) return true;
  return false;
}

// Every feed file in the folders. The same file name in two folders: the newest copy counts (L41).
export function listFeedFiles(archives) {
  const best = new Map();
  for (const dir of archives) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const f of names) {
      const awin = f.match(/^AWIN_(\d+)_(\d+)\.csv(\.gz)?$/i);
      const google = !awin && f.match(/^(\d{2,7})-[^\\/]*\.csv(\.gz)?$/i);
      if (!awin && !google) continue;
      const full = join(dir, f);
      let mtime = 0;
      try { const st = statSync(full); if (!st.isFile()) continue; mtime = st.mtimeMs; } catch { continue; }
      const key = f.toLowerCase().replace(/\.gz$/, '');
      const had = best.get(key);
      if (!had || mtime > had.mtime) best.set(key, { file: f, path: full, dir, mtime, advertiserId: Number((awin || google)[1]), kind: awin ? 'awin' : 'google' });
    }
  }
  return [...best.values()].sort((a, b) => a.advertiserId - b.advertiserId || a.file.localeCompare(b.file));
}

export async function scanArchive({ archives, maxRows = Infinity, log = () => {}, now = Date.now() }) {
  const all = listFeedFiles(archives);
  const files = [];
  const byAdv = new Map();
  let i = 0;
  for (const fi of all) {
    i++;
    const a = byAdv.get(fi.advertiserId) || { advertiserId: fi.advertiserId, merchant: '', files: [], rows: 0, products: 0, sport: 0, sportInStock: 0,
      cats: {}, also: {}, alsoSamples: {}, overlaps: {}, overlapSamples: {}, shopCats: {}, currencies: {}, samples: {}, ageDays: 9999, google: false, error: '', seen: new Set(), seenAll: new Set() };
    let map = null;
    try {
      const raw = createReadStream(fi.path);
      const stream = /\.gz$/i.test(fi.file) ? raw.pipe(createGunzip()) : raw;
      let n = 0;
      for await (const rec of readCsvRecords(stream)) {
        if (!map) {
          map = mapHeader(rec);
          // Not a product feed (another CSV that starts with a number): skip it, and do not list its name.
          if (!map.name.length) break;
          if (map.google) a.google = true;
          continue;
        }
        if (rec.length < 3) continue;
        n++; a.rows++;
        if (!a.merchant && map.merchant.length) a.merchant = pick(rec, map.merchant);
        let name = pick(rec, map.name);
        if (map.google) name = googleBaseName(name);
        const key = low(name);
        if (!key) continue;
        const brand = pick(rec, map.brand);
        const shopCat = [pick(rec, map.shopCat), pick(rec, map.awinCat)].filter(Boolean).join(' | ');
        const prodKey = `${low(brand)}|${key}`;
        if (!a.seenAll.has(prodKey)) { a.seenAll.add(prodKey); a.products++; }
        const r = classify(name, shopCat);
        if (!r.sport && !r.overlap) { if (n >= maxRows) break; continue; }
        const bucket = r.sport ? `cat:${r.cat}` : `ov:${r.overlap}`;
        if (a.seen.has(`${bucket}|${prodKey}`)) { if (n >= maxRows) break; continue; }
        a.seen.add(`${bucket}|${prodKey}`);
        const priceText = pick(rec, map.price);
        const cur = (pick(rec, map.currency) || (priceText.match(/\b([A-Z]{3})\b/) || [])[1] || '?').toUpperCase();
        const price = (priceText.match(/\d+(?:[.,]\d+)?/) || [''])[0];
        if (r.sport) {
          a.sport++;
          if (inStock(pick(rec, map.qty), pick(rec, map.flag)) !== false) a.sportInStock++;
          a.cats[r.cat] = (a.cats[r.cat] || 0) + 1;
          if (r.also) {
            a.also[r.also] = (a.also[r.also] || 0) + 1;
            const al = (a.alsoSamples[r.also] ||= []);
            if (al.length < 2 && (a.also[r.also] % 17 === 1)) al.push(`${name.slice(0, 70)} | ${price} ${cur}`);
          }
          const sc = pick(rec, map.shopCat) || pick(rec, map.awinCat) || '(no category)';
          a.shopCats[sc] = (a.shopCats[sc] || 0) + 1;
          a.currencies[cur] = (a.currencies[cur] || 0) + 1;
          const list = (a.samples[r.cat] ||= []);
          if (list.length < 3 && (a.cats[r.cat] % 23 === 1)) list.push(`${name.slice(0, 80)} | ${price} ${cur}`);
        } else {
          a.overlaps[r.overlap] = (a.overlaps[r.overlap] || 0) + 1;
          const list = (a.overlapSamples[r.overlap] ||= []);
          if (list.length < 2 && (a.overlaps[r.overlap] % 17 === 1)) list.push(`${name.slice(0, 70)} | ${price} ${cur}`);
        }
        if (n >= maxRows) break;
      }
    } catch (e) {
      if (!map && fi.kind !== 'awin') { log(`${i}/${all.length} skipped`); continue; }
      a.error = String(e && e.message || e).slice(0, 160);
    }
    if (fi.kind !== 'awin' && !(map && map.name.length)) { log(`${i}/${all.length} skipped`); continue; }
    a.files.push(`${fi.file} (${new Date(fi.mtime).toISOString().slice(0, 10)})`);
    a.ageDays = Math.min(a.ageDays, Math.floor((now - fi.mtime) / 86400000));
    files.push(fi);
    byAdv.set(fi.advertiserId, a);
    log(`${i}/${all.length} ${fi.file}`);
  }
  const advs = [...byAdv.values()];
  for (const a of advs) { delete a.seen; delete a.seenAll; }
  return { advs, files };
}

export async function readList(file) {
  const out = [];
  let head = null;
  for await (const rec of readCsvRecords(createReadStream(file))) {
    if (!head) { head = rec.map(h => String(h).trim().toLowerCase().replace(/^﻿/, '')); continue; }
    if (rec.length < 3) continue;
    const col = re => { const i = head.findIndex(h => re.test(h)); return i >= 0 ? String(rec[i] || '').trim() : ''; };
    out.push({ id: col(/^advertiser.?id$/), name: col(/^advertiser.?name$/), region: col(/region/), membership: col(/membership/),
      feedId: col(/^feed.?id$/), feedName: col(/^feed.?name$/), vertical: col(/vertical/), products: Number(col(/(no|number).?of.?products/)) || 0 });
  }
  return out;
}

const JOINED = /^(active|joined)$/i;

export function render({ advs, files = [], list = null, archives = [], generated = new Date() }) {
  const fmt = x => new Intl.NumberFormat('en-GB').format(x);
  const pct = (x, y) => (y ? `${Math.round((x / y) * 100)}%` : '-');
  const label = k => (CATEGORIES.find(c => c.key === k) || OTHER).label;
  const names = new Map();
  const joinedIds = new Set();
  if (list) for (const r of list) { if (r.id && r.name && !names.has(r.id)) names.set(r.id, r.name); if (JOINED.test(r.membership)) joinedIds.add(r.id); }
  const who = a => a.merchant || names.get(String(a.advertiserId)) || (a.google ? 'Google Shopping feed' : '?');
  const L = [];
  L.push(`SPORTS FEED SCAN (read-only) - for Sporty Gear World (sportygearworld.com, proposed code SGW) ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  L.push(`Folders read: ${archives.join(' ; ') || '-'}`);
  L.push(`Feed files: ${files.length} (newest copy of each file name)`);
  const withSport = advs.filter(a => a.sport > 0).sort((x, y) => y.sport - x.sport);
  const totalSport = withSport.reduce((t, a) => t + a.sport, 0);
  const totalInStock = withSport.reduce((t, a) => t + a.sportInStock, 0);
  L.push(`Retailers in the feeds: ${advs.length} | with sport products: ${withSport.length} | different sport products: ${fmt(totalSport)} (in stock ${pct(totalInStock, totalSport)})`);
  const errs = advs.filter(a => a.error);
  if (errs.length) L.push(`Could not read: ${errs.map(a => `${a.advertiserId} (${a.error})`).join('; ')}`);
  L.push('');
  L.push('== SPORT PRODUCTS PER PROPOSED CATEGORY (all retailers; * = scan-only group, to decide) ==');
  const tot = {}, shops = {};
  for (const a of withSport) for (const [k, x] of Object.entries(a.cats)) { tot[k] = (tot[k] || 0) + x; shops[k] = (shops[k] || 0) + 1; }
  for (const c of [...CATEGORIES, OTHER]) {
    L.push(`  ${(c.label + (c.scan ? ' *' : '')).padEnd(46)} ${fmt(tot[c.key] || 0).padStart(8)}  from ${shops[c.key] || 0} retailer(s)`);
  }
  L.push('');
  L.push('== SGW PRODUCTS THAT ALSO FIT THE RULES OF ANOTHER NEW SITE - counted above too (the yes/no rules decide) ==');
  const al = {}, alShops = {};
  for (const a of advs) for (const [k, x] of Object.entries(a.also)) { al[k] = (al[k] || 0) + x; alShops[k] = (alShops[k] || 0) + 1; }
  for (const k of ALSO_KEYS) L.push(`  ${overlapLabel(k).padEnd(62)} ${fmt(al[k] || 0).padStart(8)}  from ${alShops[k] || 0} retailer(s)`);
  L.push('');
  L.push('== SPORT PRODUCTS THAT BELONG TO ANOTHER GEAR WORLD SITE (or wait for a decision) - not counted above ==');
  const ov = {}, ovShops = {};
  for (const a of advs) for (const [k, x] of Object.entries(a.overlaps)) { ov[k] = (ov[k] || 0) + x; ovShops[k] = (ovShops[k] || 0) + 1; }
  for (const k of OVERLAP_KEYS) L.push(`  ${overlapLabel(k).padEnd(62)} ${fmt(ov[k] || 0).padStart(8)}  from ${ovShops[k] || 0} retailer(s)`);
  L.push('');
  L.push('== RETAILERS WITH SPORT PRODUCTS (most first) ==');
  for (const a of withSport) {
    const joined = list ? (joinedIds.has(String(a.advertiserId)) ? ' | Awin: JOINED' : ' | Awin: not joined or not in the list') : '';
    L.push(`-- ${a.advertiserId} ${who(a)}: ${fmt(a.sport)} sport of ${fmt(a.products)} products (${pct(a.sport, a.products)}) | sport in stock ${pct(a.sportInStock, a.sport)} | ${Object.entries(a.currencies).map(([c, x]) => `${c} ${fmt(x)}`).join(', ')} | file ${a.ageDays}d old${a.google ? ' | Google format (sizes joined)' : ''}${joined}`);
    L.push(`   by category: ${Object.entries(a.cats).sort((x, y) => y[1] - x[1]).map(([k, x]) => `${label(k)} ${fmt(x)}`).join(' | ')}`);
    const o = Object.entries(a.overlaps).sort((x, y) => y[1] - x[1]);
    if (o.length) L.push(`   other sites: ${o.map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
    const al2 = Object.entries(a.also).sort((x, y) => y[1] - x[1]);
    if (al2.length) L.push(`   also fit: ${al2.map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
    L.push(`   shop categories: ${Object.entries(a.shopCats).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, x]) => `${c.slice(0, 50)} (${fmt(x)})`).join(' | ')}`);
    for (const [k, s] of Object.entries(a.samples)) for (const x of s.slice(0, 2)) L.push(`   e.g. [${label(k)}] ${x}`);
    for (const [k, s] of Object.entries(a.overlapSamples)) for (const x of s.slice(0, 1)) L.push(`   e.g. other site [${k}] ${x}`);
    for (const [k, s] of Object.entries(a.alsoSamples)) for (const x of s.slice(0, 1)) L.push(`   e.g. also fits [${k}] ${x}`);
  }
  const onlyOverlap = advs.filter(a => a.sport === 0 && Object.keys(a.overlaps).length);
  if (onlyOverlap.length) {
    L.push('');
    L.push('== RETAILERS WITH ONLY OTHER-SITE SPORT PRODUCTS ==');
    for (const a of onlyOverlap) L.push(`  ${a.advertiserId} ${who(a)}: ${Object.entries(a.overlaps).map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
  }
  const none = advs.filter(a => a.sport === 0 && !Object.keys(a.overlaps).length);
  L.push('');
  L.push(`== NO SPORT PRODUCTS (${none.length}) ==`);
  L.push('  ' + none.map(a => `${a.advertiserId} ${who(a)}`).join(', '));
  L.push('');
  L.push('== FEED FILES USED ==');
  for (const f of files) L.push(`  ${f.file}  (${new Date(f.mtime).toISOString().slice(0, 10)}, ${f.dir})`);
  if (list) {
    L.push('');
    const here = new Set(advs.map(a => String(a.advertiserId)));
    L.push(`== AWIN FEED LIST: ${list.length} feeds, ${list.filter(r => JOINED.test(r.membership)).length} from programmes you joined ==`);
    const sport = list.filter(r => isSportProgramme(`${r.name} ${r.feedName}`, r.vertical));
    const byId = new Map();
    for (const r of sport) { const had = byId.get(r.id); if (!had) byId.set(r.id, { ...r }); else had.products += r.products; }
    const uniq = [...byId.values()].sort((x, y) => y.products - x.products);
    L.push('-- Sports programmes you JOINED --');
    for (const r of uniq.filter(r => JOINED.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | file on this PC: ${here.has(r.id) ? 'yes' : 'NO'}`);
    }
    L.push('-- Sports programmes NOT joined (apply later WITH sportygearworld.com, after it is live: open the link, "Join programme") --');
    for (const r of uniq.filter(r => !JOINED.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | ${r.membership || '?'} | https://ui.awin.com/merchant-profile/${r.id}`);
    }
    L.push('Note: the list match is by name only; check each profile before applying.');
  } else {
    L.push('');
    L.push('Awin feed list: not read (no saved feed key on this PC).');
  }
  L.push('');
  L.push('Note: a first sort by keywords, products counted once per retailer (same brand and name). Before any import, each retailer');
  L.push('gets its own yes/no rules and a dry-run report with samples (L14). Nothing was imported and no file was changed.');
  return { text: L.join('\n') + '\n', withSport };
}

function toCsv(advs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const keys = [...CATEGORIES.map(c => c.key), OTHER.key];
  const rows = [['advertiser_id', 'merchant', 'products', 'sport_products', 'sport_in_stock', ...keys, ...ALSO_KEYS.map(k => `also_fits_${k}`), ...OVERLAP_KEYS.map(k => `other_site_${k}`)]];
  for (const a of advs) rows.push([a.advertiserId, a.merchant, a.products, a.sport, a.sportInStock, ...keys.map(k => a.cats[k] || 0), ...ALSO_KEYS.map(k => a.also[k] || 0), ...OVERLAP_KEYS.map(k => a.overlaps[k] || 0)]);
  return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = x => { const i = args.indexOf(`--${x}`); return i >= 0 ? args[i + 1] : ''; };
  const archives = String(val('archive') || '').split(';').map(s => s.trim()).filter(Boolean).map(s => resolve(s));
  const found = archives.filter(d => existsSync(d));
  if (!found.length) { console.error(`Archive folder not found: ${archives.join(' ; ') || '(none given)'}`); process.exit(2); }
  const out = resolve(val('out') || 'sports-feed-scan');
  mkdirSync(out, { recursive: true });
  const { advs, files } = await scanArchive({ archives: found, maxRows: Number(val('max-rows')) || Infinity, log: m => process.stdout.write(`\r${m}`.padEnd(90).slice(0, 90)) });
  process.stdout.write('\n');
  const list = val('list') && existsSync(val('list')) ? await readList(val('list')) : null;
  const { text } = render({ advs, files, list, archives: found });
  writeFileSync(join(out, 'report.txt'), text);
  writeFileSync(join(out, 'retailers.csv'), '﻿' + toCsv(advs.sort((x, y) => y.sport - x.sport)));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
