// AliExpress PL, round 2 (owner, 15 Nov 2026, lessons L157): the newer sites' engine (tools/tgw-import-plan.mjs) places
// AliExpress products by the Polish shop's own sections ("Motoryzacja oraz części i akcesoria motoryzacyjne , Elektronika
// samochodowa , DVR do samochodu"), because its site rules read English names only. sources.json: "sections":
// "aliexpress-pl". Each site takes only its own sections, in its own categories (slugs) with an English subcategory; the
// sections of the older six sites are round 1 (tools/import-rules/aliexpress-pl.mjs).
// Wheels and tyres: kept out until chat 4's fix of the heavy category (L146); since the fix is live and the AGW tyre
// shops are in (15 Nov 2026, L159), they go to Tyres & Wheels like the tyre shops (owner: "AliExpress after the tyres").
import { NEVER, displayName } from '../aliexpress-pl.mjs';

const ok = (slug, sub) => ({ ok: true, slug, sub });

// The Polish shop's "Koła, opony i części" (wheels, tyres and parts): the sub by the name. "tyres" is the sub of the tyre
// shops' cards (lower case, as they have it), so all tyres of a size list together.
export function wheelPart(n) {
  const t = String(n || '').toLowerCase();
  // Car makers' logo stickers and badges ("naklejka z logo ... do VW"): a trademark, not a wheel part.
  if (/naklej[a-ząćęłńóśźż]* z logo|emblemat|\blogo\b/.test(t)) return 'car makers\' logo stickers and badges';
  if (/pokrowiec|torba/.test(t)) return ['tyres-wheels', 'Wheel Accessories'];
  if (/\bopon[aeyiy]?\b|\bopony\b/.test(t) && !/(?:łyżk|wentyl|naprawa|łatk|pompk|kompresor|manometr|ciśnieniomierz)/.test(t)) return ['tyres-wheels', 'tyres'];
  if (/tpms|czujnik[a-ząćęłńóśźż]* ciśnienia|czujnik[a-ząćęłńóśźż]* tpms/.test(t)) return ['tyres-wheels', 'TPMS Sensors'];
  if (/kołpak|nakład[a-ząćęłńóśźż]* na piast|dekiel|osłon[a-ząćęłńóśźż]* piasty|zaślepk/.test(t)) return ['tyres-wheels', 'Wheel Trims & Centre Caps'];
  if (/śrub|nakręt|szpilk|zabezpieczen[a-ząćęłńóśźż]* kół/.test(t)) return ['tyres-wheels', 'Wheel Nuts & Bolts'];
  if (/dystans|adapter[a-ząćęłńóśźż]* kół/.test(t)) return ['tyres-wheels', 'Spacers'];
  if (/łańcuch[a-ząćęłńóśźż]* śnieg|łańcuchy|skarpet[a-ząćęłńóśźż]* na koła/.test(t)) return ['tyres-wheels', 'Snow Chains & Socks'];
  if (/felg|obręcz|koło zapasowe|\bkoła\b/.test(t)) return ['tyres-wheels', 'Wheels'];
  return ['tyres-wheels', 'Wheel Accessories'];
}
const no = reason => ({ ok: false, reason });

// [section regex on "<first> > <second> > <third>", site, slug, sub] or [regex, site, reason] for a section left out.
// First match wins. A function in place of the slug gets (path, name) and returns [slug, sub] or a reason string.
const SECTIONS = [
  // ---- Car Gear World ----
  [/^Motoryzacja[^>]*> Części eksploatacyjne i zamienne > Koła, opony/i, 'AGW', (path, n) => wheelPart(n)],
  [/^Motoryzacja[^>]*> (Części i akcesoria do pojazdów kempingowych|Inne części)/i, 'AGW', 'camper, lorry and boat parts'],
  [/^Motoryzacja[^>]*> Elektronika samochodowa > (Zestaw rozruchowy|Kabel rozruchowy)/i, 'AGW', 'diagnostics-battery', 'Jump Starters'],
  [/^Motoryzacja[^>]*> Elektronika samochodowa > Tester alkoholu/i, 'AGW', 'breathalysers (a safety device, not checked)'],
  [/^Motoryzacja[^>]*> Elektronika samochodowa > DVR/i, 'AGW', 'car-electronics', 'Dash Cams'],
  [/^Motoryzacja[^>]*> Elektronika samochodowa > Nawigacja/i, 'AGW', 'car-electronics', 'Sat Navs'],
  [/^Motoryzacja[^>]*> Elektronika samochodowa > Systemy alarmowe/i, 'AGW', 'car-electronics', 'Car Alarms'],
  [/^Motoryzacja[^>]*> Elektronika samochodowa > (Inteligentny system|Skrzynka AI|Radia|Sprzęty audio|Samochodowe odtwarzacze|Bezprzewodowy adapter CarPlay)/i, 'AGW', 'car-electronics', 'Car Audio & CarPlay'],
  [/^Motoryzacja[^>]*> Elektronika samochodowa/i, 'AGW', 'car-electronics', 'Car Electronics Accessories'],
  [/^Motoryzacja[^>]*> Akcesoria do wnętrza pojazdu > Maty/i, 'AGW', 'interior-comfort', 'Car Mats'],
  [/^Motoryzacja[^>]*> Akcesoria do wnętrza pojazdu > Akcesoria do siedzeń/i, 'AGW', 'interior-comfort', 'Seat Covers & Cushions'],
  [/^Motoryzacja[^>]*> Akcesoria do wnętrza pojazdu > Przechowywanie/i, 'AGW', 'interior-comfort', 'Organisers'],
  [/^Motoryzacja[^>]*> Akcesoria do wnętrza pojazdu > Mocowania i uchwyty$/i, 'AGW', 'interior-comfort', 'Phone Holders & Mounts'],
  [/^Motoryzacja[^>]*> Akcesoria do wnętrza pojazdu > Odświeżacze/i, 'AGW', 'interior-comfort', 'Air Fresheners'],
  [/^Motoryzacja[^>]*> Akcesoria do wnętrza pojazdu > Kierownice/i, 'AGW', 'interior-comfort', 'Steering Wheel Covers'],
  [/^Motoryzacja[^>]*> Akcesoria do wnętrza pojazdu/i, 'AGW', 'interior-comfort', 'Interior Accessories'],
  [/^Motoryzacja[^>]*> Akcesoria zewnętrzne > (Pokrowce samochodowe|Osłony samochodowe)/i, 'AGW', 'roof-towing-exterior', 'Car Covers'],
  [/^Motoryzacja[^>]*> Akcesoria zewnętrzne > (Naklejki|Folia)/i, 'AGW', 'roof-towing-exterior', 'Stickers & Wraps'],
  [/^Motoryzacja[^>]*> Akcesoria zewnętrzne/i, 'AGW', 'roof-towing-exterior', 'Exterior Accessories'],
  [/^Motoryzacja[^>]*> Części zewnętrzne/i, 'AGW', 'roof-towing-exterior', 'Exterior Parts'],
  [/^Motoryzacja[^>]*> Światła samochodowe > Lampa robocza/i, 'AGW', 'garage-tools-equipment', 'Work Lights'],
  [/^Motoryzacja[^>]*> Światła samochodowe/i, 'AGW', 'parts-maintenance', 'Lights & Bulbs'],
  [/^Motoryzacja[^>]*> Części eksploatacyjne i zamienne/i, 'AGW', 'parts-maintenance', 'Spare Parts'],
  [/^Motoryzacja[^>]*> Części wewnętrzne/i, 'AGW', 'parts-maintenance', 'Interior Parts'],
  [/^Motoryzacja[^>]*> Części podwozia/i, 'AGW', 'parts-maintenance', 'Suspension & Steering'],
  [/^Motoryzacja[^>]*> Silniki i części silnikowe/i, 'AGW', 'parts-maintenance', 'Engine & Exhaust'],
  [/^Motoryzacja[^>]*> Czujniki/i, 'AGW', 'parts-maintenance', 'Sensors'],
  [/^Motoryzacja[^>]*> System zamka samochodowego/i, 'AGW', 'parts-maintenance', 'Keys & Key Cases'],
  [/^Motoryzacja[^>]*> Sprzęt elektryczny > Systemy ładowania/i, 'AGW', 'diagnostics-battery', 'Charging & Starting'],
  [/^Motoryzacja[^>]*> Sprzęt elektryczny/i, 'AGW', 'parts-maintenance', 'Air Conditioning & Electrics'],
  [/^Motoryzacja[^>]*> Narzędzia do konserwacji samochodów > Podnośnik/i, 'AGW', 'garage-tools-equipment', 'Jacks & Lifting'],
  [/^Motoryzacja[^>]*> Narzędzia do konserwacji samochodów/i, 'AGW', 'garage-tools-equipment', 'Car Repair Tools'],
  [/^Motoryzacja[^>]*> Narzędzia do naprawy pojazdów/i, 'AGW', 'diagnostics-battery', 'Diagnostic Tools'],
  [/^Motoryzacja[^>]*> Mycie i konserwacja samochodu > (Skrobaczki do lodu|Skrobaczki)/i, 'AGW', 'safety-winter', 'Ice Scrapers'],
  [/^Motoryzacja[^>]*> Mycie i konserwacja samochodu > Zestaw ratunkowy/i, 'AGW', 'safety-winter', 'Emergency Kits'],
  [/^Motoryzacja[^>]*> Mycie i konserwacja samochodu > Pompa/i, 'AGW', 'garage-tools-equipment', 'Tyre Inflators'],
  [/^Motoryzacja[^>]*> Mycie i konserwacja samochodu > Maszyny do polerowania/i, 'AGW', 'car-care-detailing', 'Polishers'],
  [/^Motoryzacja[^>]*> Mycie i konserwacja samochodu/i, 'AGW', 'car-care-detailing', 'Cleaning & Detailing'],
  [/^Motoryzacja[^>]*> Części i akcesoria dla pojazdów nowej energii/i, 'AGW', 'ev-charging', 'EV Chargers & Cables'],
  [/^Motoryzacja/i, 'AGW', 'car section without a place on Car Gear World'],

  // ---- Biker Gear World ----
  [/^Sport i rozrywka > Jazda na rowerze > Hulajnogi/i, 'BGW', (p, n) => (/elektryczn/i.test(n) ? ['electric-scooters', 'Electric Scooters'] : ['kick-scooters', 'Kick Scooters'])],
  [/^Sprzęty i akcesoria motocyklowe > Części motocyklowe > Oświetlenie/i, 'BGW', 'parts-maintenance', 'Lights & Indicators'],
  [/^Sprzęty i akcesoria motocyklowe > Części motocyklowe > Układ wydechowy/i, 'BGW', 'parts-maintenance', 'Exhausts'],
  [/^Sprzęty i akcesoria motocyklowe > Części motocyklowe > Hamulce/i, 'BGW', 'parts-maintenance', 'Brakes & Suspension'],
  [/^Sprzęty i akcesoria motocyklowe > Części motocyklowe > Kierownice/i, 'BGW', 'parts-maintenance', 'Handlebars & Levers'],
  [/^Sprzęty i akcesoria motocyklowe > Części motocyklowe/i, 'BGW', 'parts-maintenance', 'Motorcycle Parts'],
  [/^Sprzęty i akcesoria motocyklowe > Modyfikacje i ochrona > (Ochrona przed upadkiem|Zderzaki|Ochronniki)/i, 'BGW', 'protection', 'Crash Protection'],
  [/^Sprzęty i akcesoria motocyklowe > Modyfikacje i ochrona/i, 'BGW', 'parts-maintenance', 'Styling & Modifications'],
  [/^Sprzęty i akcesoria motocyklowe > Dodatki, dekoracje i czyszczenie > (Narzędzia|Podnośniki)/i, 'BGW', 'parts-maintenance', 'Tools & Stands'],
  [/^Sprzęty i akcesoria motocyklowe > Dodatki, dekoracje i czyszczenie > Pielęgnacja/i, 'BGW', 'parts-maintenance', 'Cleaning & Care'],
  [/^Sprzęty i akcesoria motocyklowe > Dodatki, dekoracje i czyszczenie > Bezpieczeństwo/i, 'BGW', 'luggage-security', 'Security'],
  [/^Sprzęty i akcesoria motocyklowe > Dodatki, dekoracje i czyszczenie/i, 'BGW', 'parts-maintenance', 'Styling & Modifications'],
  [/^Sprzęty i akcesoria motocyklowe > Akcesoria motocyklowe > Elektronika/i, 'BGW', 'electronics', 'Motorcycle Electronics'],
  [/^Sprzęty i akcesoria motocyklowe > Akcesoria motocyklowe > Bagaż/i, 'BGW', 'luggage-security', 'Luggage'],
  [/^Sprzęty i akcesoria motocyklowe > Akcesoria motocyklowe > Ochrona przed warunkami/i, 'BGW', 'luggage-security', 'Covers'],
  [/^Sprzęty i akcesoria motocyklowe > Akcesoria motocyklowe/i, 'BGW', 'parts-maintenance', 'Tools & Stands'],
  // Helmets protect a life: only with the European test mark in the name (ECE 22.05 / 22.06).
  [/^Sprzęty i akcesoria motocyklowe > Sprzęt motocyklowy > Kaski/i, 'BGW', (p, n) => (/\bECE\b|22[.,]0[56]/i.test(n) ? ['helmets', 'Helmets'] : 'helmet without the ECE test mark in its name')],
  [/^Sprzęty i akcesoria motocyklowe > Sprzęt motocyklowy > Odzież/i, 'BGW', 'jackets-trousers', 'Motorcycle Clothing'],
  [/^Sprzęty i akcesoria motocyklowe > Sprzęt motocyklowy > Sprzęt do skuterów śnieżnych/i, 'BGW', 'snowmobile gear'],
  [/^Sprzęty i akcesoria motocyklowe > Sprzęt motocyklowy/i, 'BGW', 'parts-maintenance', 'Motorcycle Parts'],
  [/^Sprzęty i akcesoria motocyklowe > Motocykle i ATV > Elektryczny rower na dwóch kołach/i, 'BGW', 'electric-scooters', 'Electric Scooters'],
  [/^Sprzęty i akcesoria motocyklowe > Motocykle i ATV > Części i akcesoria elektrycznych motocykli/i, 'BGW', 'electric-motorbikes', 'Electric Motorbike Parts'],
  [/^Sprzęty i akcesoria motocyklowe > Motocykle i ATV/i, 'BGW', 'parts-maintenance', 'ATV & Quad Parts'],
  [/^Sprzęty i akcesoria motocyklowe/i, 'BGW', 'boats and other vehicles'],

  // ---- Gaming Gear World (PGW) ----
  [/^Elektronika użytkowa > Gry i akcesoria > (Gamepady|Joysticki)/i, 'PGW', 'controllers', 'Controllers'],
  [/^Elektronika użytkowa > Gry i akcesoria > (Konsole|Przenośna konsola)/i, 'PGW', 'consoles', 'Consoles'],
  [/^Elektronika użytkowa > Gry i akcesoria/i, 'PGW', 'consoles', 'Console Accessories'],
  [/^Komputer i biuro > Komponenty komputerowe > Tablice demonstracyjne/i, 'TGW', 'laptops-computing', 'Electronics & Dev Boards'],
  [/^Komputer i biuro > Komponenty komputerowe/i, 'PGW', 'components', 'PC Components'],
  [/^Komputer i biuro > Akcesoria komputerowe > Monitory/i, 'PGW', 'monitors', 'Monitors'],

  // ---- Technology Gear World ----
  [/^Elektronika użytkowa > Akcesoria i części > Baterie/i, 'TGW', 'accessories-storage', 'Batteries'],
  [/^Elektronika użytkowa > Akcesoria i części > (Pilot|Uchwyty do telewizorów)/i, 'TGW', 'tv-home-cinema', 'TV Accessories'],
  [/^Elektronika użytkowa > Akcesoria i części > (Kable|Ładowarki|Akcesoria do baterii|Adaptery|Zarządzanie zasilaniem|Pudełka na akumulatory|Zwijacz)/i, 'TGW', 'accessories-storage', 'Chargers & Cables'],
  [/^Elektronika użytkowa > Akcesoria i części/i, 'TGW', 'accessories-storage', 'Accessories'],
  [/^Elektronika użytkowa > Przenośny sprzęt Audio i wideo > (Słuchawki|Akcesoria do słuchawek)/i, 'TGW', 'audio', 'Headphones & Earbuds'],
  [/^Elektronika użytkowa > Przenośny sprzęt Audio i wideo > (Głośniki|Akcesoria głośników)/i, 'TGW', 'audio', 'Speakers'],
  [/^Elektronika użytkowa > Przenośny sprzęt Audio i wideo > Mikrofony/i, 'TGW', 'audio', 'Microphones'],
  [/^Elektronika użytkowa > Przenośny sprzęt Audio i wideo > (Wzmacniacz|Przetworniki)/i, 'TGW', 'audio', 'Amplifiers & DACs'],
  [/^Elektronika użytkowa > Przenośny sprzęt Audio i wideo > Części zamienne/i, 'TGW', 'audio and video spare parts'],
  [/^Elektronika użytkowa > Przenośny sprzęt Audio i wideo/i, 'TGW', 'audio', 'Audio Accessories'],
  [/^Elektronika użytkowa > Inteligentna elektronika > (Urządzenia noszone|Części do smartwatchy)/i, 'TGW', 'phones-smartwatches', 'Smartwatches & Wearables'],
  [/^Elektronika użytkowa > Inteligentna elektronika/i, 'TGW', 'smart-home-wifi', 'Smart Home'],
  [/^Elektronika użytkowa > Aparaty fotograficzne i zdjęcia > Drony/i, 'TGW', 'cameras-drones', 'Drones'],
  [/^Elektronika użytkowa > Aparaty fotograficzne i zdjęcia > (Kamery sportowe|Akcesoria do kamer sportowych)/i, 'TGW', 'cameras-drones', 'Action Cameras'],
  [/^Elektronika użytkowa > Aparaty fotograficzne i zdjęcia > (Statywy|Kijki)/i, 'TGW', 'cameras-drones', 'Tripods & Gimbals'],
  [/^Elektronika użytkowa > Aparaty fotograficzne i zdjęcia > Studio/i, 'TGW', 'cameras-drones', 'Photo Studio'],
  [/^Elektronika użytkowa > Aparaty fotograficzne i zdjęcia > Części zamienne/i, 'TGW', 'camera spare parts'],
  [/^Elektronika użytkowa > Aparaty fotograficzne i zdjęcia/i, 'TGW', 'cameras-drones', 'Cameras & Accessories'],
  [/^Elektronika użytkowa > Audio i wideo do domu > Projekty/i, 'TGW', 'tv-home-cinema', 'Projectors'],
  [/^Elektronika użytkowa > Audio i wideo do domu > Soundbar/i, 'TGW', 'tv-home-cinema', 'Soundbars'],
  [/^Elektronika użytkowa > Audio i wideo do domu > Wzmacniacze/i, 'TGW', 'audio', 'Amplifiers & DACs'],
  [/^Elektronika użytkowa > Audio i wideo do domu > Kijki/i, 'TGW', 'cameras-drones', 'Tripods & Gimbals'],
  [/^Elektronika użytkowa > Audio i wideo do domu/i, 'TGW', 'tv-home-cinema', 'TV Accessories'],
  [/^Elektronika użytkowa/i, 'TGW', 'electronics section without a place on Technology Gear World'],
  [/^Akcesoria do telefonów i telekomunikacji > Etui/i, 'TGW', 'phones-smartwatches', 'Phone Cases'],
  [/^Akcesoria do telefonów i telekomunikacji > Folia ochronna/i, 'TGW', 'phones-smartwatches', 'Screen Protectors'],
  [/^Akcesoria do telefonów i telekomunikacji > Uchwyty i stojaki/i, 'TGW', 'phones-smartwatches', 'Phone Holders & Stands'],
  [/^Akcesoria do telefonów i telekomunikacji > Akcesoria do telefonów komórkowych/i, 'TGW', 'phones-smartwatches', 'Chargers & Cables'],
  [/^Akcesoria do telefonów i telekomunikacji > Karty Sim/i, 'TGW', 'SIM cards'],
  [/^Akcesoria do telefonów i telekomunikacji/i, 'TGW', 'phones-smartwatches', 'Phone Accessories'],
  [/^Telefony i telekomunikacja > Telefony mobilne/i, 'TGW', 'phones-smartwatches', 'Mobile Phones'],
  [/^Telefony i telekomunikacja > krótkofalówka/i, 'TGW', 'phones-smartwatches', 'Walkie Talkies'],
  [/^Telefony i telekomunikacja/i, 'TGW', 'phone repair parts, refurbished phones and telecom equipment'],
  [/^Komputer i biuro > Akcesoria komputerowe/i, 'TGW', 'laptops-computing', 'Computer Accessories'],
  [/^Komputer i biuro > Drukarki 3D/i, 'TGW', 'laptops-computing', '3D Printing'],
  [/^Komputer i biuro > Tablety/i, 'TGW', 'laptops-computing', 'Tablets'],
  [/^Komputer i biuro > Akcesoria i części do tabletów/i, 'TGW', 'laptops-computing', 'Tablet Accessories'],
  [/^Komputer i biuro > Sieci komputerowe/i, 'TGW', 'smart-home-wifi', 'Networking'],
  [/^Komputer i biuro > Części i akcesoria do laptopów/i, 'TGW', 'laptops-computing', 'Laptop Accessories'],
  [/^Komputer i biuro > Elektronika biurowa/i, 'TGW', 'laptops-computing', 'Printers & Scanners'],
  [/^Komputer i biuro > Pamięci/i, 'TGW', 'accessories-storage', 'Storage & Memory'],
  [/^Komputer i biuro > Barebone/i, 'TGW', 'laptops-computing', 'Mini PCs'],
  [/^Komputer i biuro > Laptopy/i, 'TGW', 'laptops-computing', 'Laptops'],
  [/^Komputer i biuro > Komputery stacjonarne/i, 'TGW', 'laptops-computing', 'Desktops'],
  [/^Komputer i biuro/i, 'TGW', 'crypto miners and industrial computers'],
  [/^Podzespoły elektroniczne/i, 'TGW', 'electronic components, not consumer products'],

  // ---- Sporty Gear World ----
  [/^Sport i rozrywka > Polowanie/i, 'SGW', 'hunting'],
  [/^Sport i rozrywka > (Strzelectwo|Instrumenty muzyczne)/i, 'SGW', 'paintball and musical instruments'],
  [/^Sport i rozrywka > Rozrywka > Rzutki/i, 'SGW', 'golf-skate-more', 'Darts'],
  [/^Sport i rozrywka > Rozrywka/i, 'SGW', 'gambling, coin games and fairground'],
  [/^Sport i rozrywka > Jazda na rowerze > (Rower elektryczny|Rower)/i, 'SGW', 'cycling', 'Bikes & E-bikes'],
  [/^Sport i rozrywka > Jazda na rowerze > (Akcesoria rowerowe|Sprzęt do jazdy)/i, 'SGW', 'cycling', 'Bike Accessories'],
  [/^Sport i rozrywka > Jazda na rowerze/i, 'SGW', 'cycling', 'Bike Parts'],
  [/^Sport i rozrywka > Wędkowanie/i, 'SGW', 'golf-skate-more', 'Fishing'],
  [/^Sport i rozrywka > Kamping i wędrówki > (Obserwacje astronomiczne|Teleskop)/i, 'SGW', 'telescopes'],
  [/^Sport i rozrywka > Kamping i wędrówki > Bezpieczeństwo i przetrwanie/i, 'SGW', 'first aid, tourniquets and survival kits (medical)'],
  [/^Sport i rozrywka > Kamping i wędrówki > Namioty/i, 'SGW', 'hiking-climbing-winter', 'Tents'],
  [/^Sport i rozrywka > Kamping i wędrówki/i, 'SGW', 'hiking-climbing-winter', 'Camping & Hiking'],
  [/^Sport i rozrywka > Fitness i kulturystyka > (Boks|Sztuki walki)/i, 'SGW', 'fitness-gym', 'Boxing & Martial Arts'],
  [/^Sport i rozrywka > Fitness i kulturystyka > Sprzęt do jogi/i, 'SGW', 'fitness-gym', 'Yoga'],
  [/^Sport i rozrywka > Fitness i kulturystyka > Bezpieczeństwo sportowe/i, 'SGW', 'fitness-gym', 'Supports & Protection'],
  [/^Sport i rozrywka > Fitness i kulturystyka/i, 'SGW', 'fitness-gym', 'Fitness Equipment'],
  [/^Sport i rozrywka > Narciarstwo/i, 'SGW', 'hiking-climbing-winter', 'Ski & Snowboard'],
  [/^Sport i rozrywka > Sporty wodne/i, 'SGW', 'water-sports', 'Water Sports'],
  [/^Sport i rozrywka > Sporty rakietowe/i, 'SGW', 'racket-sports', 'Table Tennis'],
  [/^Sport i rozrywka > Rolki/i, 'SGW', 'golf-skate-more', 'Skate'],
  [/^Sport i rozrywka > Golf/i, 'SGW', 'golf-skate-more', 'Golf'],
  [/^Sport i rozrywka > Sporty zespołowe/i, 'SGW', 'football-team-sports', 'Team Sports'],
  [/^Sport i rozrywka > Jazda konna/i, 'SGW', 'golf-skate-more', 'Horse Riding'],
  [/^Sport i rozrywka/i, 'SGW', 'sport section without a place on Sporty Gear World'],
  [/^Buty, odzież i akcesoria sportowe/i, 'SGW', 'sportswear-shoes-bags', 'Sportswear'],

  // ---- Pets Gear World (ZGW) ----
  [/^Dom i ogród > Produkty dla zwierząt domowych > Karma/i, 'ZGW', 'pet food from a marketplace'],
  [/^Dom i ogród > Produkty dla zwierząt domowych > Ubranka/i, 'ZGW', 'walking', 'Coats & Clothes'],
  [/^Dom i ogród > Produkty dla zwierząt domowych > Zabawki/i, 'ZGW', 'toys', 'Toys'],
  [/^Dom i ogród > Produkty dla zwierząt domowych > Legowiska/i, 'ZGW', 'beds-crates', 'Beds & Mats'],
  [/^Dom i ogród > Produkty dla zwierząt domowych > (Akwarium|Małe zwierzęta)/i, 'ZGW', 'small-pets', 'Small Pets & Aquarium'],
  [/^Dom i ogród > Produkty dla zwierząt domowych > (Artykuły do pielęgnacji|Produkty do pielęgnacji)/i, 'ZGW', 'grooming', 'Grooming'],
  [/^Dom i ogród > Produkty dla zwierząt domowych > Karmniki/i, 'ZGW', 'feeding', 'Bowls & Feeders'],
  [/^Dom i ogród > Produkty dla zwierząt domowych > Meble/i, 'ZGW', 'cats', 'Cat Trees & Furniture'],
  [/^Dom i ogród > Produkty dla zwierząt domowych > Artykuły dla ptaków/i, 'ZGW', 'birds', 'Birds'],
  [/^Dom i ogród > Produkty dla zwierząt domowych/i, 'ZGW', 'walking', 'Collars, Leads & Training'],

  // ---- Travel Gear World ----
  [/^Walizki i torby > Bagaż/i, 'VGW', 'luggage-suitcases', 'Suitcases'],
  [/^Walizki i torby > Akcesoria podróżne/i, 'VGW', 'travel-accessories', 'Travel Accessories']
];

// One product for one site: { ok, slug, sub, name } or { ok: false, reason }. site: the engine's label ('AGW', 'TGW', ...).
export function aliexpressSection(site, name, feedCategory) {
  const n = String(name || '').trim();
  if (!n) return no('no product name');
  if (NEVER.test(n)) return no('adult, smoking, weapon or medical product');
  const parts = String(feedCategory || '').split(/\s+,\s+/).map(s => s.trim()).filter(Boolean);
  const path = parts.slice(0, 3).join(' > ');
  if (!path) return no('no section in the feed');
  for (const [re, owner, a, b] of SECTIONS) {
    if (!re.test(path)) continue;
    if (owner !== site) return no(`AliExpress section of ${owner}, not this site`);
    if (typeof a === 'function') {
      const r = a(path, n);
      return Array.isArray(r) ? { ...ok(r[0], r[1]), name: displayName(n) } : no(r);
    }
    if (b === undefined) return no(a);
    return { ...ok(a, b), name: displayName(n) };
  }
  return no('AliExpress section of the older sites (round 1) or none');
}

export const SECTION_SITES = [...new Set(SECTIONS.map(s => s[1]))];
