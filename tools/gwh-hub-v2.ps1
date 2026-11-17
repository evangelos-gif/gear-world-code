<#
.SYNOPSIS
  Gear World Hub V2 ("Συνδυασμός"): the new home page of gearworldhub.com.
  Read-only unless -Step preview/live with -Apply and the typed approval phrase.

.DESCRIPTION
  The change is 5 files of the Hub, nothing else:
    worker.js              the search also takes worlds=... and max_price/min_price (for the gift finder; without them
                           it answers as before) and puts the products with all the words first (not accessories)
    public/index.html      the new page: search first, campaigns with arrows, 10 worlds, gift finder, deals, quiet
                           "Sell Your Business" card at the bottom, search dock on the phone
    public/hub-v2.css      its styles (styles.css and gwh-hero.png stay in the folder for going back, unused)
    public/hub-v2.js       campaigns, photo button, gift finder, deals and dock, with its texts in 11 languages
    public/hub-deals.json  the deals, made from promos/promos.js by tools/gwh-deals.mjs (end dates, site links)
  The D1, the 10 sites and the other Workers (gwh-sitemap too) do NOT change. The wrangler.toml of the Hub on this PC
  is used as it is (with its POSTERS line).

  -Step check    READ-ONLY. Is the hub folder on this PC still exactly the version that runs live
                 (sites/gwh/live-baseline.txt, its "# version:" line names it), and gearworldhub.com too? Cloudflare
                 login, the live version of the Worker (needed to go back), the poster counting (it goes first).
  -Step preview  CHANGES CLOUDFLARE, one approval: ΕΓΚΡΙΝΩ HUB GUIDE PRICES PREVIEW. The test Worker "gear-world-hub-preview" on a
                 *.workers.dev address gets this version (noindex, no Google Analytics, e-mail sign-up closed, no
                 poster counting; the same D1 and Workers AI, read only). gearworldhub.com does NOT change.
  -Step live     CHANGES THE LIVE HUB, one approval: ΕΓΚΡΙΝΩ HUB GUIDE PRICES LIVE. Only when the hub folder on this PC and the
                 live site are still the version of live-baseline.txt (or already this version) and the posters count
                 already. First a zip of the hub folder and the number of the live version (for rollback), then the
                 changed files go into the hub folder, then gearworldhub.com is deployed from it and checked. If the
                 deploy fails, the old files go back into the hub folder, so it stays the same as the live site.
  -Step register CHANGES THE HUB D1 (one row), one approval: ΕΓΚΡΙΝΩ HUB ZGW SEARCH. Adds Pets Gear World (ZGW,
                 petsgearworld.com) to the list of sites in the D1 "gear-world-registry", so the Hub search and the photo
                 search ask it too. Time Travel restore point first. Nothing else in the D1 changes; running it twice
                 adds nothing (INSERT OR IGNORE).
  -Step remove-preview  CHANGES CLOUDFLARE (the test Worker only), one approval: ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW. Deletes the
                 test Worker "gear-world-hub-preview" (owner, 29/10/2026: no test address is left running after a live
                 update). gearworldhub.com, its D1 and the sites do NOT change.
  -Step indexnow  Tells IndexNow (Bing, Yandex and others) that the pages of the Hub sitemap changed. Needs -Apply, no phrase:
                 it changes nothing on the Hub, its D1 or the sites. The live step does it by itself after a deploy.
  Biker card (31/10/2026, live): index.html, translations.js, hub-v2.js, hub-v2.css and hub-bgw.jpg.
  Gaming card (31/10/2026, live): the same 4 files and hub-pgw.jpg, "12 Gear Worlds" in the texts.
  Pets card (1/11/2026, live): the same 4 files and hub-zgw.jpg, "13 Gear Worlds" in the texts. One paste: live, register,
  remove-preview, each with its own phrase (BGW and PGW are already in the D1 list of sites).
  Bing Webmaster Tools (31/10/2026, live): robots.txt with the Sitemap line, the new title of the home page, meta
  descriptions of 120-160 characters and the IndexNow key file.
  Email step 5a (2/11/2026, live, tools/gwh-mailerlite.ps1): mailerlite.js, sign-ups to the Hub D1 and MailerLite.
  Get deal updates (L92): members.js and worker.js, the sign-ups of the sites (service binding HUB) into the same list.
  Gift guides (4/11/2026): /guides/ and 5 guide pages made by tools/gwh-guides.mjs from sites/gwh/guides/guides.json,
  their links under the gift finder (index.html, hub-v2.js, hub-v2.css). Phrases of this release: ΕΓΚΡΙΝΩ HUB GUIDES PREVIEW,
  then ΕΓΚΡΙΝΩ HUB GUIDES LIVE together with remove-preview (ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW) in the same paste.
  Shop categories (owner, 4/11/2026, option A): worker.js only, /api/registry gets shop_categories from the sites'
  site.config.js (tools/gwh-shop-categories.mjs). Phrases of this release: ΕΓΚΡΙΝΩ HUB REGISTRY PREVIEW, then ΕΓΚΡΙΝΩ HUB
  REGISTRY LIVE together with remove-preview. The D1 and /api/classify do not change (L70).
  Google Ads review (7/11/2026, lessons L101): the new page /about/ (who runs Gear World, that it sells nothing,
  contact@gearworldhub.com, in 11 languages by about.js), "About" in the menu opens it, the "Sell Your Business"
  sponsored card is gone, and every page's footer says "Run by Evangelos Kalogerakis, United Kingdom · We don't sell
  products" (owner's decision, 7/11/2026). The deals line says "From retailers listed on Gear World" and the Christmas
  slide speaks of gifts, not offers. worker.js does not change. Phrases of this release: ΕΓΚΡΙΝΩ HUB ADS PREVIEW, then ΕΓΚΡΙΝΩ HUB ADS LIVE
  together with remove-preview (ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW) in the same paste. Live since 7/11/2026 (f4c8c35).
  Product search and price comparison, not shops (lessons L102, after the appeal): "The idea" of the home page says
  "Independent product search and price comparison.", the world cards say "Explore →" (not "Shop →"), the campaign
  texts have no "13 specialist shops", "Shop sport", "our retailers" or Halloween "offers", privacy says "a product
  search and price-comparison service", and the styles of the sponsored card are gone; all 11 languages, new ?v= for
  hub-v2.css, hub-v2.js and translations.js. worker.js does not change. Phrases of that release: ΕΓΚΡΙΝΩ HUB WORDING
  PREVIEW / LIVE (live since 7/11/2026 21:54, 5842265).
  Clean-up after the appeal (lessons L103): the affiliate disclosure and privacy say what is there (the Hub links only to
  the Gear World sites and has no affiliate links, true until L121 of 14/11/2026; since L176 they name that one Sovrn
  link; the retailer links of the sites go through Awin), contact says
  "business enquiries", terms say who runs Gear World, the 3 changed legal pages get a new "Last updated"; the deals
  slides (Halloween, Black Friday, the winter slide) speak of the retailers' codes only while one runs, otherwise they
  show the sign-up text and button; the winter slide is "After Christmas across 13 Gear Worlds"; the Greek "partner
  shops", the French "paniers"/"Baskets" and the English "retailer" inside other languages are gone; the gift guides
  say "retailer" instead of "shop"; styles.css (not loaded by the page) loses the rules of the sponsored card. New ?v=
  for hub-v2.css, hub-v2.js and translations.js. worker.js and the D1 do not change. Phrases of this release: ΕΓΚΡΙΝΩ HUB
  CLEANUP PREVIEW, then ΕΓΚΡΙΝΩ HUB CLEANUP LIVE together with remove-preview (ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW) in the same paste.
  Live since 7/11/2026 23:50 (faf047a).
  robots.txt (lessons L105, 8/11/2026): public/robots.txt starts with "User-agent: SERankingBacklinksBot" and "Disallow: /"
  (an SEO crawler that opened about 1,000 product pages an hour on cargearworld.com); every other line stays as it was.
  Only that file changes; worker.js and the D1 do not. The test address always answers robots.txt with its own
  "Disallow: /", so a preview cannot show this change and is not needed: the live step does not ask for one. After the
  deploy the live check reads gearworldhub.com/robots.txt: the Sitemap line and the SERankingBacklinksBot lines.
  Phrases of that release: ΕΓΚΡΙΝΩ HUB ROBOTS LIVE (live since 8/11/2026 15:28, a0b1901).
  Security fixes (lessons L106, 8/11/2026): security.js (new), worker.js, mailerlite.js, members.js, public/index.html,
  public/email-signup.js and public/privacy/index.html. Turnstile on the Hub sign-up form (loaded only when the form is
  used) and the Hub checks the tokens of the 13 sites' "Get deal updates" box; one daily limit of sign-ups for the network
  (the app, without a widget, has its own small one); the translations of the search are kept for a day, never for bots,
  within one daily limit, and the sites get translate=0 when the Hub has translated already; charset=utf-8 and the full
  Content-Security-Policy as Report-Only (reports to /api/csp-report); the live Hub's wrangler.toml gets workers_dev = false
  and preview_urls = false. The live step refuses until the Hub has its Turnstile keys (tools/gw-security-fixes.ps1
  -Step turnstile, ΕΓΚΡΙΝΩ TURNSTILE) and the 13 sites already send the token (tools/ads-fixes-sites.ps1, ΕΓΚΡΙΝΩ ADS FIXES).
  Phrases of that release: ΕΓΚΡΙΝΩ HUB SECURITY PREVIEW, then ΕΓΚΡΙΝΩ HUB SECURITY LIVE (live since 8/11/2026, 0577b79).
  Google Ads compliance (lessons L107, 9/11/2026): worker.js passes the visitor's country to every site (?deliver_to=, so
  the search shows only retailers that deliver there), hub-v2.js has the season switches of promos/promos.js (Black
  Friday and its countdown OFF until the owner turns them on; nothing switches on by its dates alone), hub-deals.json
  has no Joybuy Halloween codes, the email box says what it sends (no "prices we've checked"), and the affiliate
  disclosure, privacy and cookies name Awin and CJ. Second round (checker of 9/11/2026): /api/search is private and
  sends deliver_to=GB for an unknown country and for Google's crawlers; a visitor outside the UK sees the bar "We're
  adding retailers for your country..." above the header of the home page (added per answer, never stored); the gift
  guides show the real price, "RRP" and the days their prices were checked (no "previous price"), and the Joybuy sales
  have no percentages. The preview and the live step read every product a gift guide links to from the live D1 of its
  site (SELECT by primary key, tools/gwh-guide-guard.mjs): the report lists any that would show a notice or were checked
  more than 14 days ago, and the live step refuses while one would show a notice.
  The 13 sites go FIRST (tools/ads-fixes-sites.ps1, ΕΓΚΡΙΝΩ ADS FIXES), so
  every site already reads ?deliver_to when the Hub sends it. Phrases of that release: ΕΓΚΡΙΝΩ HUB COMPLIANCE PREVIEW,
  then ΕΓΚΡΙΝΩ HUB COMPLIANCE LIVE together with remove-preview (ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW) in the same paste
  (live since 09/11/2026 20:35, fb9953f).
  Gift guide prices (lessons L109, 9/11/2026): only the gift guides change (public/guides/index.html and the 5 guide
  pages, made by tools/gwh-guides.mjs from sites/gwh/guides/guides.json). Every price is the price its site shows,
  with the day it was checked; the products of Coes, Bazta UK and the older Joybuy rows (no new price check since
  24-26 Oct, so "Check price and stock at the retailer" and later a notice) are replaced by similar products of the
  same site checked on 8-9 Nov. worker.js, the other pages and the D1 do not change. The guard now stops the live step
  on a PRICE line too (another price in guides.json than on the site, exit 20), like a NOTICE; OLD stays a warning.
  Phrases of that release: ΕΓΚΡΙΝΩ HUB GUIDE PRICES PREVIEW, then ΕΓΚΡΙΝΩ HUB GUIDE PRICES LIVE together with
  remove-preview (ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW) in the same paste (live since 09/11/2026 21:46).
  Mitgo verification and guide prices (lessons L119, 13/11/2026): worker.js adds <meta name="mitgo-verification"
  content="<code>"> at the end of the <head> of the home page while the Worker secret MITGO_VERIFICATION has a code of
  that form. The code has the form of a UUID, so it is never in the repo: -MitgoCode '<code>' sets it, on the test Worker
  in the preview step and on gear-world-hub in the live step, right before the deploy (it stays for later deploys).
  The gift guides get the prices their sites showed on 13/11 (8 Joybuy products had other prices) and the day each
  product was last checked there. -AfterPreview (live step): goes on only when the newest preview report is of this code
  version, from the last 2 hours, ended ΕΤΟΙΜΟ and has no ΠΡΟΒΛΗΜΑ, so preview, live and remove-preview can be in one
  paste. Phrases of that release, in this order: ΕΓΚΡΙΝΩ HUB MITGO PREVIEW, ΕΓΚΡΙΝΩ HUB MITGO LIVE, ΕΓΚΡΙΝΩ HUB REMOVE
  PREVIEW (live since 13/11/2026 22:50).
  Sovrn Commerce (lessons L121, 14/11/2026): the home page gets ONE product link of Sovrn Commerce, for the approval of
  gearworldhub.com there: a «Featured pick» card (STRAUSS e.s. S3 safety boots Okomu mid, engelbert-strauss.co.uk) with
  rel="sponsored nofollow noopener", the words «Affiliate link» and the commission note like the product links of the
  sites. No Sovrn script (it would rewrite links, Awin and CJ too). The checks here count the link and its rel, and never
  open it: Sovrn counts only real clicks of visitors. Phrases of that release, in this order: ΕΓΚΡΙΝΩ HUB SOVRN PREVIEW,
  ΕΓΚΡΙΝΩ HUB SOVRN LIVE, ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW (live since 14/11/2026 16:50).
  Impact verification (lessons L150, 14/11/2026): worker.js adds <meta name='impact-site-verification' value='<code>'>,
  exactly as Impact gives it (single quotes, value=), after the Mitgo tag at the end of the <head> of the home page, while
  the Worker secret IMPACT_VERIFICATION has a code of that form. A UUID, so never in the repo: -ImpactCode '<code>' sets
  it on the test Worker (preview) and on gear-world-hub right before the deploy (live); it stays for later deploys. The
  Mitgo tag stays as it is. Phrases of that release, in this order: ΕΓΚΡΙΝΩ HUB IMPACT PREVIEW, ΕΓΚΡΙΝΩ HUB IMPACT LIVE,
  ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW (one paste, live with -AfterPreview; live since 14/11/2026 18:48). Exit codes 21 and 22 as
  for -MitgoCode. -ImpactCode is not needed again: the secret stays for later deploys.
  Delivery badges (lessons L153, 14/11/2026, after the open-country rule of the sites, L151): every product card of the
  Hub (search, gift finder, photo search) says "<retailer> delivers to: <countries>", from the delivery countries each
  site gives (/api/products delivers_to), the retailer name untranslated, the country names in the visitor's language.
  worker.js asks every site with badges=1, so a visitor from a country that is not open sees all the products there, as
  on the sites; a site of before L151 ignores it and answers as before (no line on its cards). New ?v= for the 4 changed
  scripts in index.html. Phrases of this release, in this order: ΕΓΚΡΙΝΩ HUB BADGES PREVIEW, ΕΓΚΡΙΝΩ HUB BADGES LIVE,
  ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW (one paste, live with -AfterPreview).
  Stores (owner's option B, lessons L166, 16/11/2026): a new section of the Hub instead of a new site. /stores/ lists
  big retailers (Joybuy, AliExpress PL, Tooled Up, PCHUB.UK, GS Workwear, Back to the Office, My Tool Shed, DHgate) by the
  country they deliver to, and /stores/<slug>/ shows, per retailer, where it delivers, its codes and sales with their
  end dates, and the Gear World sites that list its products (each site's search filtered by the retailer, ?for=pl for a
  retailer that delivers only to Poland). Made by tools/gwh-stores.mjs from sites/gwh/stores/stores.json, like the
  gift guides; links only to Gear World pages (never /out/, /go/ or a retailer), so the Hub has no new affiliate link.
  The home page gets a 14th card «Stores» after the 13 worlds (own classes, so the 13 world cards stay as they are;
  texts in 11 languages in hub-v2.js; the picture hub-stores.jpg is the photos of 4 world cards). The banner place on
  a retailer page stays empty until a banner is checked. worker.js, translations.js, the D1 and gwh-sitemap do not change.
  Phrases of this release, in this order: ΕΓΚΡΙΝΩ HUB STORES PREVIEW, ΕΓΚΡΙΝΩ HUB STORES LIVE, ΕΓΚΡΙΝΩ HUB REMOVE
  PREVIEW (one paste, live with -AfterPreview). The live check opens /stores/ and the 8 store pages. The preview
  reports and the live step refuses (exit 24) while a code or sale of stores.json has ended on the UK day
  (node tools/gwh-stores.mjs validate): the titles and counts of the pages would still name it.
  Live since 16/11/2026 20:12 (88e65d5).
  Search model (lessons L173, 17/11/2026): Cloudflare retires @cf/meta/llama-3.1-8b-instruct-fp8 on 20/11/2026 (404
  model_not_found after that). worker.js translated a foreign search with it (and retried an English one with no
  result); both now use the model of the photo search, @cf/google/gemma-4-26b-a4b-it, without thinking, from
  photo-search.js (TEXT_MODEL, translationInput, answerText: the answer in any shape, one line only). The pages, the
  D1, translations.js and gwh-sitemap do not change. Phrases of this release, in this order: ΕΓΚΡΙΝΩ HUB AI PREVIEW,
  ΕΓΚΡΙΝΩ HUB AI LIVE, ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW (one paste, live with -AfterPreview), before 20/11/2026.
  Language (lessons L174, 17/11/2026, from Linkwise's review): the «Featured pick» card was English on every language of
  the Hub, and the world cards opened the sites in English (each site keeps its own language). hub-v2.js now has the
  card's texts in the 11 languages (the retailer and its website in their own translate="no", {name}) and adds
  ?lang=<language> to a link to one of the 13 sites when it is used, only for a language the visitor chose on the Hub,
  English included (never on /go/ or /out/); the page keeps the plain addresses. Same release and phrases as L173.
  Country language (lessons L175, owner 17/11/2026: "every country opens in its own language"): worker.js names the
  language of the visitor's country on <html data-country-lang> of the home page and /about/ (the same countries as the sites, in
  the 11 languages of the Hub; Belgium, Switzerland, Luxembourg by the browser; never for Google, never on a stored
  copy, never for a crawler); translations.js and about.js use it only without a choice of the visitor's own and do
  not save it (an en-GB saved before L175 is a choice only with the menu's mark gwh-language-chosen). The live checks of
  this tool and of gwh-mailerlite, gwh-photo, gwh-search-labels and poster-setup take the mark out before comparing.
  Legal pages (lessons L176, owner 17/11/2026): privacy, cookies, terms, affiliate disclosure and contact (and the
  footer of /about/) in the 11 languages: legal.js loads public/legal/i18n/<language>.json (each block by its English
  HTML, the same links and tags) for pages with <html data-lg-i18n>, with a note that the English text applies; the
  Worker names the country language on those pages too. The affiliate disclosure, privacy, cookies and /about/ name the
  one affiliate link of the Hub itself, the "Featured pick" card (Sovrn Commerce, L121), in the 11 languages, with the
  Sovrn privacy policy (until then they said "The Hub itself has no affiliate links"); the footer of the home page is
  in the 11 languages too, and so are the campaign names of the deals (from the dictionary of the deal's site, made
  by tools/gwh-deals.mjs as campaignNames).
  Search order (lessons L177, 17/11/2026): the Hub orders the answers of the 13 sites with rankHubResults (worker.js):
  what the product IS (subcategory, category, the retailer's path) first, then whole words of its name; accessories and
  look-alikes go down unless asked for. Test-Site makes 13 searches for a UK visitor (?country=GB): one of the first 3
  results must come from the Gear World that sells it; 2 or more wrong orders, or the Hub's search failing twice, are a
  ΠΡΟΒΛΗΜΑ, so -AfterPreview stops the live; a Gear World that does not answer twice is a ΠΡΟΣΟΧΗ (L74). The full list
  of 65 searches: node tools/gwh-search-check.mjs (--replay before a deploy).
  Live since 17/11/2026 18:39 (ec76e012, L174-L177, phrases ΕΓΚΡΙΝΩ HUB AI PREVIEW / LIVE / REMOVE PREVIEW).
  A search typed as a sentence (Idea 9 phase 1, lessons L180, owner's ΕΓΚΡΙΝΩ ΙΔΕΑ 9 ΦΑΣΗ 1 of 17/11/2026): worker.js
  reads "i want to buy a tablet for my son under £200" first with rules that cost nothing (understandQuery: the words
  around the product go, a price phrase becomes max/min, "for my son / for her / for my dog" pushes kgw / wgw / mgw / zgw
  first, never a filter), and asks the search model (TEXT_MODEL, the same daily limit, never for a bot, L106) only for a
  sentence the rules leave. A price written in a currency is compared at the sites' daily rates (/api/fx). The answer has
  "understood"; app.js shows it above the results in the 11 languages with "Search exactly for ..." (exact=1); the
  photo search and the gift finder are as before. The privacy page says a sentence may be read by Cloudflare Workers AI
  (11 languages, 17 November 2026). Test-Site also checks 3 sentences for a UK visitor (the tool is a bot, so rules
  only): the product, the price limit, the Gear World named first, and a plain search stays as typed. Phrases of this
  release, in this order: ΕΓΚΡΙΝΩ HUB SEARCH PREVIEW, ΕΓΚΡΙΝΩ HUB SEARCH LIVE, ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW (one paste,
  live with -AfterPreview). Full list: node tools/gwh-search-check.mjs --sentences.
  Live since 17/11/2026 21:19 (1d34366c). The same phrases carry its follow-up release (the privacy date: 17 November,
  not 20: the page went live three days early at the owner's request).
  Release order (L175): the 13 sites go live FIRST (sites-update-all, phrase ΕΓΚΡΙΝΩ ALL UPDATES), and only after their
  report this Hub release. Check that https://<site>/api/version of the sites is on the release with L175 first;
  otherwise a visitor in Greece who made no choice gets a Greek Hub and English sites.
  Exit codes added by L119: 21 the -MitgoCode has another form, 22 the code did not go into the live Worker (nothing went
  live), 23 -AfterPreview without a clean preview report of this version (nothing changed).
  Report: <home>\gear-world-reports\GWH_HUB_V2_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'preview', 'live', 'register', 'remove-preview', 'indexnow')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$HubDir = '',
    [string]$WorkDir = '',
    [string]$BaselineFile = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard,
    [switch]$NoHttpCheck,
    [string]$MitgoCode = '',
    [string]$ImpactCode = '',
    [switch]$AfterPreview
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$HubWorker = 'gear-world-hub'
$PreviewName = 'gear-world-hub-preview'
$DbName = 'gear-world-registry'
$PhrasePreview = 'ΕΓΚΡΙΝΩ HUB SEARCH PREVIEW'
$PhraseLive = 'ΕΓΚΡΙΝΩ HUB SEARCH LIVE'
$PhraseRegister = 'ΕΓΚΡΙΝΩ HUB ZGW SEARCH'
$PhraseRemovePreview = 'ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW'
$LiveUrl = 'https://gearworldhub.com'
# IndexNow (Bing Webmaster Tools, 31/10/2026): the key is public by design, it is served as /<key>.txt.
$IndexNowKey = 'gearworldhub-indexnow-k7q4m9x2w5'
$HomeTitle = 'Gear World Hub ' + [char]0x2013 + ' Gear, Gifts & Deals From Every Gear World'
# Security fixes (lessons L106): the Hub's Turnstile keys (names only; the values are Worker secrets, never here), and the
# 13 sites whose "Get deal updates" box must already send the Turnstile token before the Hub checks it.
$HubTurnstileSecrets = @('TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY_2', 'TURNSTILE_SITE_KEY')
$SiteDomains = @('constructiongearworld.com', 'mensgearworld.com', 'womensgearworld.com', 'kidsgearworld.com', 'homegearworld.com', 'gardengearworld.com', 'technologygearworld.com', 'cargearworld.com', 'travelgearworld.com', 'sportygearworld.com', 'bikergearworld.com', 'gaminggearworld.com', 'petsgearworld.com')
if (-not $HubDir) { $HubDir = Join-Path $HOME 'gear-world-hub' }
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-hub-v2' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$sep = [System.IO.Path]::DirectorySeparatorChar
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

# What each file of the change does, in the words of the report.
$About = @{
    'worker.js' = 'η σειρά των αποτελεσμάτων της αναζήτησης με το rankHubResults: πρώτα τι είναι το προϊόν (κατηγορίες), μετά ολόκληρες λέξεις του ονόματος, αξεσουάρ πιο κάτω (GWH-RANKING-V3, L177)· η αναζήτηση μεταφράζει τις ξένες λέξεις με το μοντέλο της αναζήτησης με φωτογραφία (Gemma 4), γιατί το Cloudflare σταματά το @cf/meta/llama-3.1-8b-instruct-fp8 στις 20/11 (L173)· η αρχική σελίδα παίρνει τη γλώσσα της χώρας του επισκέπτη (<html data-country-lang>, μόνο σε κάθε απάντηση, ποτέ για το Google, L175)· όλα τα άλλα όπως είναι live'
    'photo-search.js' = 'κρατά το μοντέλο της μετάφρασης της αναζήτησης (ίδιο με της φωτογραφίας) και διαβάζει την απάντησή του σε κάθε μορφή (L173)· η αναζήτηση με φωτογραφία δεν αλλάζει'
    'security.js'           = 'νέο αρχείο: έλεγχος Turnstile, ημερήσια όρια του δικτύου (εγγραφές, μεταφράσεις), headers (L106)'
    'mailerlite.js'         = 'η φόρμα του Hub θέλει το token του Turnstile· ημερήσιο όριο εγγραφών για όλο το δίκτυο, μικρό δικό της για την εφαρμογή (L106)'
    'members.js'            = 'η φόρμα «Get deal updates» των sites: το Hub ελέγχει το token του Turnstile κάθε site, ίδιο ημερήσιο όριο, ημερήσιο όριο μεταφράσεων για τα sites (/internal/ai-slot) (L106)'
    'public/email-signup.js' = 'το κουτί email λέει τι στέλνει: κωδικούς που δημοσιεύουν τα καταστήματα και νέα των sites, όχι «prices we''ve checked», 11 γλώσσες (L107)· Turnstile όταν αρχίζει η φόρμα (L106)'
    'poster-scan.js'        = 'η μέτρηση των αφισών (ίδια με αυτή που μπήκε με το POSTER STATS)'
    'public/index.html' = 'η κάρτα «Featured pick» παίρνει τα κείμενά της από το hub-v2.js (11 γλώσσες) και νέο ?v= για το hub-v2.js (L174, L31)· όλα τα άλλα όπως είναι live'
    'public/legal/i18n/el-GR.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα el-GR για το legal.js (L176)'
    'public/legal/i18n/de-DE.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα de-DE για το legal.js (L176)'
    'public/legal/i18n/fr-FR.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα fr-FR για το legal.js (L176)'
    'public/legal/i18n/it-IT.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα it-IT για το legal.js (L176)'
    'public/legal/i18n/es-ES.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα es-ES για το legal.js (L176)'
    'public/legal/i18n/pt-PT.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα pt-PT για το legal.js (L176)'
    'public/legal/i18n/nl-NL.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα nl-NL για το legal.js (L176)'
    'public/legal/i18n/sq-AL.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα sq-AL για το legal.js (L176)'
    'public/legal/i18n/ro-RO.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα ro-RO για το legal.js (L176)'
    'public/legal/i18n/ru-RU.json' = 'νέο αρχείο: τα κείμενα των νομικών σελίδων στα ru-RU για το legal.js (L176)'
    'public/legal/legal.js' = 'και τα ονόματα των δύο μενού για αναγνώστες οθόνης (aria-label, L176)· οι νομικές σελίδες στη γλώσσα του επισκέπτη (επιλογή του, μετά της χώρας του, μετά Αγγλικά) από τα αρχεία legal/i18n (L176)· το έτος του footer και η επιλογή cookies όπως πριν'
    'public/about/index.html' = 'το «Every product links…» λέει και το Sovrn Commerce της κάρτας «Featured pick» (L176, L121)· νέο ?v= για το legal.js και data-lg-i18n (L176)· νέο ?v= για το about.js (L175, L31)· νέα σελίδα /about/: «Run by Evangelos Kalogerakis, United Kingdom», ότι δεν πουλάμε, δεν παίρνουμε πληρωμές, δεν κάνουμε παραδόσεις, contact@gearworldhub.com (νέο αρχείο, L101)'
    'public/about/about.js' = 'το ίδιο κείμενο για το Sovrn Commerce σε 11 γλώσσες (L176)· χωρίς δική του επιλογή γλώσσας ο επισκέπτης βλέπει τη σελίδα στη γλώσσα της χώρας του, όπως την αρχική (L175)· η σελίδα /about/ στη γλώσσα που διάλεξε ο επισκέπτης, 11 γλώσσες (νέο αρχείο, L101)'
    'public/privacy/index.html' = 'το μόνο affiliate link του ίδιου του Hub, η κάρτα «Featured pick», πάει μέσω Sovrn Commerce, με link στην πολιτική απορρήτου του Sovrn (L176, L121)· στη γλώσσα του επισκέπτη μέσω legal.js (data-lg-i18n, L176), «outside the UK and the European Economic Area», νέα γραμμή «Language», «Last updated: 17 November 2026»· τα links των sites περνούν από το Awin ή το CJ, με την πολιτική απορρήτου και των δύο· «Last updated: 9 November 2026» (L107)'
    'public/cookies/index.html' = 'το affiliate network: «Awin, CJ for a few retailers, or Sovrn Commerce for the "Featured pick" card» (L176)· στη γλώσσα του επισκέπτη μέσω legal.js (L176), νέες γραμμές gwh-language-chosen και gwh2-season-paused, «Last updated: 17 November 2026»· τα cookies του affiliate network: «Awin, or for a few retailers CJ»· «Last updated: 9 November 2026» (L107)· νέα γραμμή στο footer και link «About» (L101)'
    'public/affiliate-disclosure/index.html' = 'η μόνη εξαίρεση, η κάρτα «Featured pick» (Affiliate link, Sovrn Commerce), αντί για «The Hub itself has no affiliate links», «Last updated: 17 November 2026» (L176, L121)· στη γλώσσα του επισκέπτη μέσω legal.js (data-lg-i18n, L176)· τα κουμπιά των sites περνούν από ένα affiliate network: Awin, ή για λίγα καταστήματα CJ· «Last updated: 9 November 2026» (L107)'
    'public/hub-v2.css'     = 'στο κινητό το Pets και το Stores μικρά, το ένα δίπλα στο άλλο (όπως οι άλλες κάρτες)· κάτω από 380 px εικόνα 40 px και τίτλος 13 px, ώστε το «Καταστήματα» να χωράει σε μία γραμμή (L166)'
    'public/hub-v2.js' = 'το όνομα της καμπάνιας μιας προσφοράς στη γλώσσα του επισκέπτη, όπως στο λεξικό του site της (campaignNames, L176)· η κάρτα «Featured pick» σε 11 γλώσσες (το κατάστημα και το site του αμετάφραστα), και ένα link προς ένα από τα 13 sites παίρνει τη γλώσσα που διάλεξε ο επισκέπτης στο Hub (?lang=) τη στιγμή που πατιέται (L174)· όλα τα άλλα όπως είναι live'
    'public/hub-stores.jpg' = 'η φωτογραφία της κάρτας «Stores»: οι φωτογραφίες 4 κόσμων μαζί (Pexels, ήδη στο Hub)'
    'public/stores/index.html' = 'νέα σελίδα /stores/: τα μεγάλα καταστήματα ανά χώρα παράδοσης (L166)'
    'public/stores/stores.css' = 'η εμφάνιση των σελίδων /stores/ (νέο αρχείο, L166)'
    'public/stores/stores.js' = 'κρύβει μόνο του κωδικό, έκπτωση ή μπάνερ που έληξε (νέο αρχείο, L166)'
    'public/stores/joybuy/index.html' = 'σελίδα Joybuy: UK, 4 εκπτώσεις έως 31/12, 12 sites (L166)'
    'public/stores/aliexpress-pl/index.html' = 'σελίδα AliExpress PL: μόνο Πολωνία, 12 sites με ?for=pl (L166)'
    'public/stores/tooled-up/index.html' = 'σελίδα Tooled Up: UK, κωδικοί CLAIMFIFTY και CLAIMSEVFY έως 6/12, 4 sites (L166)'
    'public/stores/pchub-uk/index.html' = 'σελίδα PCHUB.UK: UK, 2 sites (L166)'
    'public/stores/gs-workwear/index.html' = 'σελίδα GS Workwear: UK, 2 sites (L166)'
    'public/stores/back-to-the-office/index.html' = 'σελίδα Back to the Office: UK, 6 sites (L166)'
    'public/stores/my-tool-shed/index.html' = 'σελίδα My Tool Shed: UK, κωδικοί CLAIMFIFTY και CLAIMSEVFY έως 6/12, 2 sites (L166)'
    'public/stores/dhgate/index.html' = 'σελίδα DHgate: UK, παιδικές μπότες στο Kids (L166)'
    'public/gear-world-camera.js' = 'κάθε κάρτα της αναζήτησης με φωτογραφία λέει «<κατάστημα> delivers to: …» (L153)'
    'public/app.js' = 'κάθε κάρτα της αναζήτησης λέει «<κατάστημα> delivers to: …» κάτω από το κατάστημα (L153)'
    'public/styles.css'     = 'φεύγουν οι κανόνες της κάρτας «Sell Your Business» (.gwh-business-*) και τα σχόλια «shop» (το αρχείο δεν το φορτώνει η σελίδα· μένει για τα παλιά εργαλεία) (L103)'
    'public/contact/index.html' = 'στη γλώσσα του επισκέπτη μέσω legal.js (data-lg-i18n, L176)· «business enquiries from retailers and affiliate networks» αντί για «partnership enquiries» (L103)'
    'public/guides/guides.css' = 'η εμφάνιση των οδηγών δώρων: «RRP» αντί για διαγραμμένη τιμή και «n% below» (L107)'
    'public/guides/index.html' = 'οι οδηγοί δώρων: «Prices checked between 8 Nov 2026 and 11 Nov 2026», «for him, from £21», «for her, from £12» (L119)'
    'public/guides/christmas-gifts-for-him/index.html' = 'οδηγός δώρων για εκείνον: Wahl £21.88 (ήταν £23.03), σακίδιο Calvin Klein £64.78 (ήταν £71.00), όπως τα δείχνει το Men''s Gear World στις 13/11· νέες ημερομηνίες ελέγχου (L119)'
    'public/guides/christmas-gifts-for-her/index.html' = 'οδηγός δώρων για εκείνη: Olaplex £12.50 (ήταν £15.00), Christian Louboutin £60.50 (ήταν £54.52), όπως τα δείχνει το Women''s Gear World στις 13/11· νέες ημερομηνίες ελέγχου (L119)'
    'public/guides/christmas-gifts-for-kids/index.html' = 'οδηγός δώρων για παιδιά: LEGO DUPLO £26.24, K''NEX £24.49, COBI £26.79, LEGO Technic £32.50, όπως τα δείχνει το Kids'' Gear World στις 13/11· νέες ημερομηνίες ελέγχου (L119)'
    'public/guides/christmas-gifts-for-diy-lovers/index.html' = 'οδηγός δώρων για μάστορες: ίδιες τιμές, ελεγμένες 11/11, και οι νέοι τίτλοι των άλλων οδηγών στο «More gift guides» (L119)'
    'public/guides/christmas-gifts-for-travellers/index.html' = 'οδηγός δώρων για ταξιδιώτες: ίδιες τιμές, ελεγμένες 10/11, και οι νέοι τίτλοι των άλλων οδηγών στο «More gift guides» (L119)'
    'public/translations.js' = 'τα νομικά links του footer της αρχικής σε 11 γλώσσες, με τις λέξεις των νομικών σελίδων (L176)· χωρίς δική του επιλογή γλώσσας ο επισκέπτης βλέπει τη γλώσσα της χώρας του, χωρίς να αποθηκεύεται (L175)· οι λέξεις «<κατάστημα> delivers to» και «Worldwide» σε 11 γλώσσες και η γραμμή παράδοσης κάθε κάρτας (το όνομα του καταστήματος αμετάφραστο, οι χώρες στη γλώσσα του επισκέπτη, έως 3 και «+n») (L153)'
    'public/robots.txt'     = 'robots.txt του Hub: πρώτα «User-agent: SERankingBacklinksBot» με «Disallow: /» (L105), από κάτω ίδιο όπως ήταν, με τη γραμμή Sitemap: https://gearworldhub.com/sitemap.xml (το Cloudflare βάζει από πάνω τα Content Signals του)'
    'public/gearworldhub-indexnow-k7q4m9x2w5.txt' = 'το κλειδί του IndexNow (δημόσιο, έτσι δουλεύει το IndexNow)'
    'public/terms/index.html' = 'στη γλώσσα του επισκέπτη μέσω legal.js (data-lg-i18n, L176)· «operated by Gear World (run by Evangelos Kalogerakis, United Kingdom)», «Last updated: 7 November 2026» (L103)'
    'public/hub-bgw.jpg'    = 'η φωτογραφία της κάρτας Biker (Pexels, χωρίς μάρκες)'
    'public/hub-pgw.jpg'    = 'η φωτογραφία της κάρτας Gaming (Pexels, χωρίς μάρκες)'
    'public/hub-zgw.jpg'    = 'η φωτογραφία της κάρτας Pets (Pexels, χωρίς μάρκες)'
    'public/hub-deals.json' = 'το όνομα της καμπάνιας και στις 10 άλλες γλώσσες από το λεξικό του site (campaignNames, L176)· οι προσφορές με ημερομηνία λήξης, από το promos.js, χωρίς τους κωδικούς Halloween του Joybuy και χωρίς ποσοστά στις εκπτώσεις (L107)'
    'public/seasonal/halloween.mp4' = 'Halloween (βίντεο) για το μπάνερ των προσφορών'
    'public/seasonal/halloween.jpg' = 'Halloween (σταθερή εικόνα) για το μπάνερ των προσφορών'
    'public/seasonal/black-friday.mp4' = 'Black Friday (βίντεο) για το μπάνερ των προσφορών'
    'public/seasonal/black-friday.jpg' = 'Black Friday (σταθερή εικόνα) για το μπάνερ των προσφορών'
    'public/seasonal/christmas.mp4' = 'Χριστούγεννα (βίντεο) για το μπάνερ των προσφορών'
    'public/seasonal/christmas.jpg' = 'Χριστούγεννα (σταθερή εικόνα) για το μπάνερ των προσφορών'
}

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('GWH_HUB_V2_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GWH_HUB_V2_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor $Ok }
    exit $code
}

# Normalise an approval phrase: no accents, upper case, single spaces; Latin "EGKRINO" also accepted.
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    return ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
}

# -Approve may hold several phrases separated by ";" (one per change). Without it the phrase is typed.
function Confirm-Approval([string]$phrase) {
    $given = @()
    if ($Approve) { $given = @($Approve -split ';') }
    else {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor $Warn
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $given = @(Read-Host 'Έγκριση')
    }
    foreach ($g in $given) { if ((Normalize-Phrase $g) -eq (Normalize-Phrase $phrase)) { return $true } }
    return $false
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-hubv2-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up'
        if ($code -eq 0 -or -not $network -or $try -eq $tries) { break }
        Say ('Πρόβλημα δικτύου με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα...' -f (5 * $try)) $Warn
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The JSON array in wrangler's output. Windows PowerShell 5.1 gives a JSON array back as ONE object (the array):
# it is flattened here, so the items are real items (lessons L76).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

# Lessons L107: every product a Hub gift guide links to, read from the live D1 of its site by primary key (one SELECT per
# site, never a write) and judged like its page in the UK view by tools/gwh-guide-guard.mjs. Returns
# @{ ok; notices; old; prices; lines }: notices = products whose page would show a notice instead of the product;
# prices = products whose price in guides.json is not the price their site shows (lessons L109).
function Test-GuideProducts([string]$folder) {
    $res = @{ ok = $true; notices = 0; old = 0; prices = 0; lines = @() }
    $guard = Join-Path (Join-Path $repo 'tools') 'gwh-guide-guard.mjs'
    $guardPlan = @(& node $guard plan)
    if ($LASTEXITCODE -ne 0 -or $guardPlan.Count -eq 0) { $res.ok = $false; return $res }
    foreach ($line in $guardPlan) {
        $parts = ([string]$line).Split([char]9)
        if ($parts.Count -ne 3 -or $parts[2] -notmatch '^SELECT [a-z_, ]+ FROM products WHERE id IN \([0-9,]+\)$') { $res.ok = $false; continue }
        $q = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "{1}"' -f $parts[1], $parts[2]) -Retry
        $tmpIn = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-guard-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.json')
        $tmpOut = $tmpIn + '.txt'
        [System.IO.File]::WriteAllText($tmpIn, $q.text, (New-Object System.Text.UTF8Encoding($false)))
        & node $guard judge $parts[0] $tmpIn --out $tmpOut | Out-Null
        $found = $false
        if (Test-Path -LiteralPath $tmpOut) {
            foreach ($t in @([System.IO.File]::ReadAllText($tmpOut, [System.Text.Encoding]::UTF8) -split "`n")) {
                $m = [regex]::Match($t, '^GUARD \S+ checked=\d+ notices=(\d+) old=(\d+) prices=(\d+)')
                if ($m.Success) { $found = $true; $res.notices += [int]$m.Groups[1].Value; $res.old += [int]$m.Groups[2].Value; $res.prices += [int]$m.Groups[3].Value }
                elseif ($t.Trim()) { $res.lines += $t.Trim() }
            }
        }
        Remove-Item -LiteralPath $tmpIn, $tmpOut -ErrorAction SilentlyContinue
        if (-not $found) { $res.ok = $false; $res.lines += ('{0}: η απάντηση της βάσης δεν διαβάστηκε' -f $parts[0]) }
    }
    return $res
}
# (The loop variable is not $l: PowerShell names ignore case, and Say would then see it instead of the report list $L.)
function Say-GuideProducts($g) {
    foreach ($guideLine in $g.lines) { Say ('  ' + $guideLine) }
    if (-not $g.ok) { Say 'Προϊόντα των οδηγών δώρων: ΠΡΟΒΛΗΜΑ - δεν μπόρεσα να τα διαβάσω όλα από τις βάσεις (δίκτυο;).' $Bad }
    else {
        if ($g.notices -gt 0) { Say ('Προϊόντα των οδηγών δώρων: ΠΡΟΒΛΗΜΑ - {0} θα έδειχναν ειδοποίηση αντί για το προϊόν (δες NOTICE). Χρειάζεται νέο guides.json πριν το live.' -f $g.notices) $Bad }
        # L109: a guide price that is not the price of the site is a price we cannot back up (Google Ads).
        if ($g.prices -gt 0) { Say ('Τιμές των οδηγών δώρων: ΠΡΟΒΛΗΜΑ - {0} προϊόντα έχουν στον οδηγό άλλη τιμή από αυτή που δείχνει τώρα το site τους (δες PRICE). Χρειάζεται νέο guides.json πριν το live.' -f $g.prices) $Bad }
        if ($g.notices -eq 0 -and $g.old -gt 0) { Say ('Προϊόντα των οδηγών δώρων: ΠΡΟΣΟΧΗ - όλα φαίνονται, αλλά {0} έχουν τιμή ελεγμένη πριν από 14+ μέρες (δες OLD): η σελίδα τους λέει «Check price and stock at the retailer».' -f $g.old) $Warn }
        if ($g.notices -eq 0 -and $g.prices -eq 0 -and $g.old -eq 0) { Say 'Προϊόντα των οδηγών δώρων: όλα φαίνονται κανονικά, με την τιμή του site και τιμή ελεγμένη τις τελευταίες 14 μέρες: ΕΝΤΑΞΕΙ' $Ok }
    }
}

# Lessons L166: the Stores pages name codes and sales in their titles and counts. On the UK day after an offer ends
# they would still name it, so the live step refuses until stores.json and the pages are built again (Claude).
# Offline (node tools/gwh-stores.mjs validate): reads only the repo. Returns @{ ok; lines }.
function Test-Stores {
    $res = @{ ok = $true; lines = @() }
    $tool = Join-Path (Join-Path $repo 'tools') 'gwh-stores.mjs'
    if (-not (Test-Path -LiteralPath $tool)) { return $res }
    $out = @(& node $tool validate 2>&1 | ForEach-Object { [string]$_ })
    $res.lines = $out
    if ($LASTEXITCODE -ne 0) { $res.ok = $false }
    return $res
}
function Say-Stores($r) {
    if ($r.ok) { Say 'Σελίδες Stores: κανένας κωδικός ή καμία έκπτωση δεν έληξε (σημερινή ημέρα UK): ΕΝΤΑΞΕΙ' $Ok; return }
    Say 'Σελίδες Stores: ΠΡΟΒΛΗΜΑ - κάποιος κωδικός ή κάποια έκπτωση έληξε και οι σελίδες θα την ανέφεραν ακόμα:' $Bad
    foreach ($line in $r.lines) { Say ('  ' + $line) }
}

function Get-Sha([byte[]]$bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}

function Local-Path([string]$root, [string]$rel) { return (Join-Path $root ($rel.Replace('/', $sep))) }

function Get-FileSha([string]$path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return '' }
    return (Get-Sha ([System.IO.File]::ReadAllBytes($path)))
}

# Copy of this repo version, ready for wrangler (npm ci once per version, so the wrangler version is fixed).
function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path (Join-Path $dest 'sites') -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path (Join-Path $repo 'sites') 'gwh') -Destination (Join-Path $dest 'sites') -Recurse -Force
        foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-hubv2-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
    }
    return $dest
}

# Downloads a page or file like a browser: @{ status; bytes; headers }. status 0 = could not be read.
function Get-Web([string]$url) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
        $req.Accept = '*/*'
        $req.Timeout = 30000
        $resp = $req.GetResponse()
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ status = 0; bytes = (New-Object byte[] 0); headers = $null } }
    } catch {
        return @{ status = 0; bytes = (New-Object byte[] 0); headers = $null }
    }
    try {
        $ms = New-Object System.IO.MemoryStream
        $resp.GetResponseStream().CopyTo($ms)
        return @{ status = [int]$resp.StatusCode; bytes = $ms.ToArray(); headers = $resp.Headers }
    } finally { $resp.Close() }
}

# sha256 of a live file as the Worker sends it: 'missing' for 404, 'error' when it could not be read.
# Cloudflare Web Analytics adds its own beacon script to HTML for some visitors (lessons L71): it is taken out first.
# So is the bar the Worker adds for a visitor outside the UK (lessons L107), when this PC is not in the UK.
function Get-LiveSha([string]$url, [bool]$isHtml) {
    $w = Get-Web $url
    if ($w.status -eq 404) { return 'missing' }
    if ($w.status -ne 200) { return 'error' }
    $bytes = $w.bytes
    if ($isHtml) {
        $enc = New-Object System.Text.UTF8Encoding($false)
        $text = $enc.GetString($bytes)
        $clean = [regex]::Replace($text, '<script[^>]*static\.cloudflareinsights\.com/beacon\.min\.js[^>]*></script>\r?\n?', '')
        $clean = [regex]::Replace($clean, '<div class="gwh2-country-bar" role="note"><p class="container" data-gwh2="countryBar">[^<]*</p></div>', '')
        # The Mitgo verification tag the Worker adds to the <head> of the home page (L119): its code is a Worker secret.
        $clean = [regex]::Replace($clean, '<meta name="mitgo-verification" content="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}">', '')
        $clean = [regex]::Replace($clean, "<meta name='impact-site-verification' value='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'>", '')
        # L175: the language of the PC's country on <html> of the home page (a PC outside the UK).
        $clean = [regex]::Replace($clean, ' data-country-lang="[a-z]{2}-[A-Z]{2}"', '')
        if ($clean -ne $text) { $bytes = $enc.GetBytes($clean) }
    }
    return (Get-Sha $bytes)
}

function Get-UrlPath([string]$rel) {
    $p = $rel.Substring(7)
    if ($p -eq 'index.html') { return '/' }
    if ($p -match '/index\.html$') { return ('/' + $p.Substring(0, $p.Length - 10)) }
    return ('/' + $p)
}

# Deploy; when Cloudflare answers "This Worker does not exist" (code 10007) right after an upload, wait and deploy
# once more: a deploy is safe to repeat (lessons L72). Any other error is not repeated.
function Invoke-Deploy([string]$folder, [string]$config) {
    $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $config)
    if ($d.code -ne 0 -and $d.text -match 'code: 10007') {
        Say 'Το Cloudflare δεν απάντησε σωστά στο ανέβασμα. Ξαναδοκιμάζω σε 15 δευτερόλεπτα...' $Warn
        Start-Sleep -Seconds 15
        $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $config)
    }
    return $d
}

# The version of a Worker that is live now (for going back). Read-only. wrangler lists the deployments oldest first:
# the last "Version(s):" block is the live one, and it must be ONE version with 100% of the visitors.
function Get-LiveVersion([string]$folder, [string]$name) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $name) -Retry
    if ($r.code -ne 0) { return '' }
    $at = $r.text.LastIndexOf('Version(s):')
    if ($at -lt 0) { return '' }
    $ms = [regex]::Matches($r.text.Substring($at), '\((\d+)%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -ne 1 -or $ms[0].Groups[1].Value -ne '100') { return '' }
    return $ms[0].Groups[2].Value
}

# The preview config from the template: its own Worker name, a workers.dev address, GWH_PREVIEW = "1", and WITHOUT
# the POSTERS line (the test address never counts poster scans). Never the live name.
function Write-PreviewConfig([string]$folder, [string]$dbId) {
    $text = [System.IO.File]::ReadAllText((Join-Path $folder 'wrangler.toml.example'))
    if ($text -notmatch '(?m)^name = "gear-world-hub"\r?$' -or $text.IndexOf('REPLACE_WITH_DATABASE_ID') -lt 0 -or $text -notmatch '(?m)^compatibility_date = ') {
        Say 'Το πρότυπο wrangler.toml.example δεν έχει τη μορφή που περίμενα: ΔΕΝ ανέβασα τίποτα.' $Bad; Finish 13
    }
    $text = $text.Replace('REPLACE_WITH_DATABASE_ID', $dbId)
    $text = [regex]::Replace($text, '(?m)^name = "gear-world-hub"(\r?)$', ('name = "{0}"$1' -f $PreviewName))
    # The template has "workers_dev = false" (live Hub, F04, lessons L106): the test Worker gets workers.dev instead (one key).
    $text = [regex]::Replace($text, '(?m)^(workers_dev|preview_urls) = (true|false)\r?\n', '')
    $text = [regex]::Replace($text, '(?m)^(compatibility_date = [^\r\n]+)', ('$1' + "`nworkers_dev = true"))
    $text = [regex]::Replace($text, '(?m)^\[\[services\]\]\r?\nbinding = "POSTERS"\r?\nservice = "[^"]+"\r?\n?', '')
    $text = $text.TrimEnd() + "`n`n[vars]`nGWH_PREVIEW = `"1`"`n"
    if ($text -match '(?m)^name = "gear-world-hub"\r?$' -or $text -notmatch ('(?m)^name = "{0}"' -f $PreviewName) -or $text -match 'binding = "POSTERS"') { Say 'Λάθος ρύθμιση για το preview: ΔΕΝ ανέβασα τίποτα.' $Bad; Finish 13 }
    $file = Join-Path $folder 'wrangler.preview.toml'
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
    return $file
}

# The secret for the anonymous visitor code of the photo search on the test Worker: random, never shown or kept.
function Set-PreviewSecret([string]$folder) {
    $rnd = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($rnd) } finally { $rng.Dispose() }
    $salt = [Convert]::ToBase64String($rnd).Replace('+', '-').Replace('/', '_').TrimEnd('=')
    $secretFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-hubv2-secret-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.json')
    [System.IO.File]::WriteAllText($secretFile, ('{{"PHOTO_LIMIT_SALT":"{0}"}}' -f $salt), (New-Object System.Text.UTF8Encoding($false)))
    try {
        return (Invoke-Wrangler $folder ('secret bulk "{0}" --name {1}' -f $secretFile, $PreviewName))
    } finally {
        Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue
    }
}

# L119: one Worker secret given in this run (the Mitgo code), through a temporary file that is deleted at once. The value
# is never shown, kept or written into a report (Hide-Ids masks codes of this form too).
function Set-WorkerSecret([string]$folder, [string]$worker, [string]$name, [string]$value) {
    $secretFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-hubv2-secret-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.json')
    [System.IO.File]::WriteAllText($secretFile, ('{{"{0}":"{1}"}}' -f $name, $value), (New-Object System.Text.UTF8Encoding($false)))
    try {
        return (Invoke-Wrangler $folder ('secret bulk "{0}" --name {1}' -f $secretFile, $worker))
    } finally {
        Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue
    }
}

# L119: preview, live and remove-preview in one paste. With -AfterPreview the live step goes on only when the newest
# preview report (GWH_HUB_V2_PREVIEW_*.txt) is of this code version, from the last 2 hours, ended ΕΤΟΙΜΟ and has no
# ΠΡΟΒΛΗΜΑ line: a preview that failed, was refused or found a problem stops the live step before any change.
function Test-PreviewReport {
    $last = @(Get-ChildItem -LiteralPath $OutDir -Filter 'GWH_HUB_V2_PREVIEW_*.txt' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime, Name | Select-Object -Last 1)
    if ($last.Count -eq 0) { Say 'Δεν βρήκα αναφορά του preview (-AfterPreview): ΔΕΝ ανεβάζω το Hub, δεν άλλαξε τίποτα. Στείλε στο Claude αυτή την αναφορά.' $Bad; return $false }
    $r = $last[0]
    $text = [System.IO.File]::ReadAllText($r.FullName, [System.Text.Encoding]::UTF8)
    $why = @()
    if (((Get-Date) - $r.LastWriteTime).TotalMinutes -gt 120) { $why += 'είναι πιο παλιά από 2 ώρες' }
    if (-not $text.Contains('Code version: ' + (Split-Path -Leaf $repo))) { $why += 'είναι άλλης έκδοσης του κώδικα' }
    if (-not $text.Contains('ΕΤΟΙΜΟ: άνοιξε τη δοκιμαστική διεύθυνση')) { $why += 'δεν τελείωσε με ΕΤΟΙΜΟ' }
    if ($text.Contains('ΠΡΟΒΛΗΜΑ')) { $why += 'λέει ΠΡΟΒΛΗΜΑ' }
    if ($why.Count -gt 0) {
        Say ('Η αναφορά του preview {0} {1}: ΔΕΝ ανεβάζω το Hub, δεν άλλαξε τίποτα. Στείλε στο Claude αυτή την αναφορά.' -f $r.Name, ($why -join ', ')) $Bad
        return $false
    }
    Say ('Preview αυτής της έκδοσης ({0}): ΕΤΟΙΜΟ, χωρίς ΠΡΟΒΛΗΜΑ: ΕΝΤΑΞΕΙ' -f $r.Name) $Ok
    return $true
}

# The new page and the new search, on the test address or on gearworldhub.com after the deploy.
function Test-Site([string]$base, [bool]$isLive) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $page = Get-Web ($base + '/?gwcheck=' + $stamp)
    $html = (New-Object System.Text.UTF8Encoding($false)).GetString($page.bytes)
    $robots = $(if ($page.headers) { [string]$page.headers['X-Robots-Tag'] } else { '' })
    $pageOk = ($page.status -eq 200 -and $html.Contains('/hub-v2.js?v=') -and $html.Contains('id="hubSearch"') -and $html.Contains('id="gwh2Campaigns"'))
    if ($pageOk) { Say '  Η νέα αρχική σελίδα ανοίγει: ΕΝΤΑΞΕΙ' $Ok } else { Say ('  Η νέα αρχική σελίδα: ΠΡΟΒΛΗΜΑ (απάντηση {0})' -f $page.status) $Bad }
    if ($isLive) {
        if ($robots -notmatch 'noindex') { Say '  Οι μηχανές αναζήτησης βλέπουν τη σελίδα (χωρίς noindex): ΕΝΤΑΞΕΙ' $Ok } else { Say '  ΠΡΟΣΟΧΗ: το live έχει noindex!' $Bad }
    } else {
        if ($robots -match 'noindex') { Say '  Δοκιμαστική διεύθυνση με noindex (δεν μπαίνει στο Google): ΕΝΤΑΞΕΙ' $Ok } else { Say '  ΠΡΟΣΟΧΗ: η δοκιμαστική διεύθυνση δεν λέει noindex.' $Warn }
    }
    $titleOk = $html.Contains('<title>Gear World Hub ' + [char]0x2013 + ' Gear, Gifts &amp; Deals From Every Gear World</title>')
    if ($titleOk) { Say '  Νέος τίτλος της αρχικής: ΕΝΤΑΞΕΙ' $Ok } else { Say '  Νέος τίτλος της αρχικής: ΠΡΟΣΟΧΗ - δεν τον βλέπω ακόμα (cache;)' $Warn }
    # L121: the one Sovrn Commerce link of the home page, counted and never opened (Sovrn counts only visitors' clicks).
    $sovrn = [regex]::Matches($html, '<a [^>]*href="https://sovrn\.co/[^"]+"[^>]*>')
    $sovrnScript = [regex]::IsMatch($html, '(?i)<script[^>]+(sovrn|viglink)')
    if ($sovrn.Count -eq 1 -and $sovrn[0].Value.Contains('rel="sponsored nofollow noopener"') -and -not $sovrnScript) { Say '  Link του Sovrn στην αρχική: 1, με rel="sponsored nofollow noopener", χωρίς script του Sovrn (δεν ανοίχτηκε): ΕΝΤΑΞΕΙ' $Ok }
    elseif ($sovrn.Count -gt 0 -or $sovrnScript) { Say ('  Link του Sovrn στην αρχική: ΠΡΟΒΛΗΜΑ - {0} links, script του Sovrn: {1}.' -f $sovrn.Count, $sovrnScript) $Bad }
    # L166: the Stores card of the home page and the /stores/ pages (made by tools/gwh-stores.mjs).
    $rcard = $html.Contains('href="/stores/" data-world="STORES"')
    $rlist = Get-Web ($base + '/stores/?gwcheck=' + $stamp)
    $rlistHtml = (New-Object System.Text.UTF8Encoding($false)).GetString($rlist.bytes)
    $rslugs = @([regex]::Matches($rlistHtml, 'href="/stores/([a-z0-9-]+)/"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
    $rbad = @()
    foreach ($rs in $rslugs) {
        $rp = Get-Web ($base + '/stores/' + $rs + '/?gwcheck=' + $stamp)
        $rpHtml = (New-Object System.Text.UTF8Encoding($false)).GetString($rp.bytes)
        if ($rp.status -ne 200 -or -not $rpHtml.Contains('<link rel="canonical" href="https://gearworldhub.com/stores/' + $rs + '/">') -or $rpHtml -match '/(out|go)/') { $rbad += $rs }
    }
    if ($rcard -and $rlist.status -eq 200 -and $rslugs.Count -ge 1 -and $rbad.Count -eq 0) { Say ('  Κάρτα «Stores» στην αρχική και {0} σελίδες καταστημάτων στο /stores/ (L166): ΕΝΤΑΞΕΙ' -f $rslugs.Count) $Ok }
    else { Say ('  Σελίδες /stores/ (L166): ΠΡΟΒΛΗΜΑ - κάρτα: {0}, λίστα: απάντηση {1}, σελίδες: {2}, με πρόβλημα: {3}' -f $rcard, $rlist.status, $rslugs.Count, ($rbad -join ', ')) $Bad }
    # L119: the Mitgo tag right before </head> of the home page (a new secret takes a few seconds to reach every answer).
    # (L150: the Impact tag, when there is one, comes after it and right before </head>.)
    $mitgoRx = '<meta name="mitgo-verification" content="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})">(?:<meta name=''impact-site-verification'' value=''[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}''>)?</head>'
    $mt = [regex]::Match($html, $mitgoRx)
    if ($MitgoCode) {
        for ($i = 1; $i -le 3 -and -not ($mt.Success -and $mt.Groups[1].Value -eq $MitgoCode); $i++) {
            Start-Sleep -Seconds 10
            $again = Get-Web ($base + '/?gwcheck=' + $stamp + '-m' + $i)
            $mt = [regex]::Match((New-Object System.Text.UTF8Encoding($false)).GetString($again.bytes), $mitgoRx)
        }
        if ($mt.Success -and $mt.Groups[1].Value -eq $MitgoCode) { Say '  Ετικέτα επαλήθευσης Mitgo στο <head> της αρχικής, με τον κωδικό σου: ΕΝΤΑΞΕΙ' $Ok }
        else { Say '  Ετικέτα επαλήθευσης Mitgo: ΠΡΟΒΛΗΜΑ - δεν τη βλέπω με τον κωδικό σου στο <head> της αρχικής.' $Bad }
    } elseif ($mt.Success) { Say '  Ετικέτα επαλήθευσης Mitgo στο <head> της αρχικής: υπάρχει (μυστικό MITGO_VERIFICATION του Worker): ΕΝΤΑΞΕΙ' $Ok }
    # L150: the Impact tag, exactly as Impact gives it, right before </head>.
    $impactRx = '<meta name=''impact-site-verification'' value=''([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})''></head>'
    $it = [regex]::Match($html, $impactRx)
    if ($ImpactCode) {
        for ($i = 1; $i -le 3 -and -not ($it.Success -and $it.Groups[1].Value -eq $ImpactCode); $i++) {
            Start-Sleep -Seconds 10
            $again = Get-Web ($base + '/?gwcheck=' + $stamp + '-i' + $i)
            $it = [regex]::Match((New-Object System.Text.UTF8Encoding($false)).GetString($again.bytes), $impactRx)
        }
        if ($it.Success -and $it.Groups[1].Value -eq $ImpactCode) { Say '  Ετικέτα επαλήθευσης Impact στο <head> της αρχικής, με τον κωδικό σου: ΕΝΤΑΞΕΙ' $Ok }
        else { Say '  Ετικέτα επαλήθευσης Impact: ΠΡΟΒΛΗΜΑ - δεν τη βλέπω με τον κωδικό σου στο <head> της αρχικής.' $Bad }
    } elseif ($it.Success) { Say '  Ετικέτα επαλήθευσης Impact στο <head> της αρχικής: υπάρχει (μυστικό IMPACT_VERIFICATION του Worker): ΕΝΤΑΞΕΙ' $Ok }
    $rb = Get-Web ($base + '/robots.txt?gwcheck=' + $stamp)
    $rbText = (New-Object System.Text.UTF8Encoding($false)).GetString($rb.bytes)
    if (-not $isLive) {
        # The test address answers robots.txt itself with "Disallow: /" (photo-search.js previewResponse): the Hub's own
        # robots.txt with the Sitemap line is seen on gearworldhub.com only.
        if ($rb.status -eq 200 -and $rbText -match '(?m)^Disallow: /\s*$') { Say '  robots.txt της δοκιμαστικής: κλειστή για τις μηχανές αναζήτησης: ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  robots.txt της δοκιμαστικής: ΠΡΟΣΟΧΗ - δεν λέει Disallow: / (απάντηση {0})' -f $rb.status) $Warn }
    } else {
        $rbSitemap = ($rb.status -eq 200 -and $rbText.Contains('Sitemap: https://gearworldhub.com/sitemap.xml'))
        # L105: SERankingBacklinksBot may read nothing (its two lines, one after the other).
        $rbBot = ($rb.status -eq 200 -and $rbText -match '(?m)^User-agent: SERankingBacklinksBot[ \t]*\r?\nDisallow: /[ \t]*\r?$')
        if ($rbSitemap) { Say '  robots.txt με τη γραμμή Sitemap: ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  robots.txt: ΠΡΟΣΟΧΗ - δεν βλέπω τη γραμμή Sitemap (απάντηση {0})' -f $rb.status) $Warn }
        if ($rbBot) { Say '  robots.txt: «User-agent: SERankingBacklinksBot» με «Disallow: /» (L105): ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  robots.txt: ΠΡΟΣΟΧΗ - δεν βλέπω το «User-agent: SERankingBacklinksBot» με «Disallow: /» (L105, απάντηση {0}). Η cache κρατάει έως λίγα λεπτά: στείλε στο Claude αυτή την αναφορά.' -f $rb.status) $Warn }
    }
    $kf = Get-Web ($base + '/' + $IndexNowKey + '.txt?gwcheck=' + $stamp)
    $kfText = (New-Object System.Text.UTF8Encoding($false)).GetString($kf.bytes).Trim()
    if ($kf.status -eq 200 -and $kfText -eq $IndexNowKey) { Say '  Κλειδί IndexNow: ΕΝΤΑΞΕΙ' $Ok } else { Say ('  Κλειδί IndexNow: ΠΡΟΣΟΧΗ (απάντηση {0})' -f $kf.status) $Warn }
    # Security fixes (L106): the public Turnstile sitekey of the sign-up form, charset=utf-8 and the Report-Only policy.
    $ts = Get-Web ($base + '/api/turnstile?gwcheck=' + $stamp)
    $tsText = (New-Object System.Text.UTF8Encoding($false)).GetString($ts.bytes)
    if ($ts.status -eq 200 -and $tsText -match '"sitekey"') { Say '  Turnstile της φόρμας εγγραφής (/api/turnstile): ΕΝΤΑΞΕΙ' $Ok } else { Say ('  Turnstile της φόρμας εγγραφής: ΠΡΟΒΛΗΜΑ (απάντηση {0})' -f $ts.status) $Bad }
    $ct = $(if ($page.headers) { [string]$page.headers['Content-Type'] } else { '' })
    $ro = $(if ($page.headers) { [string]$page.headers['Content-Security-Policy-Report-Only'] } else { '' })
    if ($ct -match 'charset=utf-8' -and $ro -match 'challenges\.cloudflare\.com') { Say '  charset=utf-8 και CSP (Report-Only) της αρχικής: ΕΝΤΑΞΕΙ' $Ok } else { Say '  charset=utf-8 / CSP Report-Only της αρχικής: ΠΡΟΣΟΧΗ - δεν τα βλέπω ακόμα (cache;)' $Warn }
    $deals = Get-Web ($base + '/hub-deals.json?gwcheck=' + $stamp)
    if ($deals.status -eq 200) { Say '  Οι προσφορές (hub-deals.json) διαβάζονται: ΕΝΤΑΞΕΙ' $Ok } else { Say ('  Οι προσφορές (hub-deals.json): ΠΡΟΒΛΗΜΑ (απάντηση {0})' -f $deals.status) $Bad }
    # Google Ads compliance (L107): no Halloween code in the deals, Black Friday switched off in the script, the email box
    # without "prices we've checked".
    $dealsText = (New-Object System.Text.UTF8Encoding($false)).GetString($deals.bytes)
    $v2 = Get-Web ($base + '/hub-v2.js?gwcheck=' + $stamp)
    $v2Text = (New-Object System.Text.UTF8Encoding($false)).GetString($v2.bytes)
    $l107 = ($deals.status -eq 200 -and $dealsText -notmatch '(?i)halloween') -and ($v2.status -eq 200 -and $v2Text.Contains('"black-friday":false')) -and -not $html.Contains('prices we' + [char]0x27 + 've checked')
    if ($l107) { Say '  L107: καμία προσφορά Halloween, Black Friday κλειστή, το κουτί email χωρίς «prices we''ve checked»: ΕΝΤΑΞΕΙ' $Ok }
    else { Say '  L107: ΠΡΟΣΟΧΗ - δεν βλέπω ακόμα όλες τις αλλαγές (προσφορές χωρίς Halloween, Black Friday κλειστή, κουτί email). Η cache κρατάει λίγα λεπτά: στείλε στο Claude αυτή την αναφορά.' $Warn }
    # L177 (17/11/2026): the search finds what it names, for a UK visitor (?country=GB). One search per Gear World: one of
    # the first 3 results comes from the Gear World that sells it, every result delivers to the UK. A search whose Gear
    # World did not answer is asked once more; still no answer = not checked (a warning about the site, L74), never a wrong
    # order. The Hub's own search failing twice, 2 or more wrong orders, or a product that does not deliver to the UK, are a
    # problem (no live).
    $searchSet = @(
        @('safety boots', 'cgw'), @('tablet', 'tgw'), @('dog bed', 'zgw'), @('gaming chair', 'pgw'), @('motorcycle helmet', 'bgw'),
        @('tyre inflator', 'agw'), @('suitcase', 'vgw'), @('yoga mat', 'sgw'), @('dress', 'wgw'), @('mens watch', 'mgw'),
        @('pram', 'kgw'), @('kettle', 'hgw'), @('bbq', 'ggw'))
    $wrongOrder = @(); $notChecked = @(); $hubErrors = @(); $notUk = 0; $missing = @(); $asked = 0
    foreach ($pair in $searchSet) {
        $sj = $null; $failedHere = @()
        for ($try = 1; $try -le 2; $try++) {
            $sq = Get-Web ($base + '/api/search?q=' + [uri]::EscapeDataString($pair[0]) + '&country=GB&gwcheck=' + $stamp + '-' + $try)
            $sj = $null; $failedHere = @()
            try { $sj = (New-Object System.Text.UTF8Encoding($false)).GetString($sq.bytes) | ConvertFrom-Json } catch { $sj = $null }
            if ($sj -and $sj.PSObject.Properties['failed_sites'] -and $sj.failed_sites) { $failedHere = @($sj.failed_sites | ForEach-Object { [string]$_ }) }
            if ($sj -and $sj.ok -and -not ($failedHere -contains $pair[1])) { break }
            Start-Sleep -Seconds 2
        }
        if (-not ($sj -and $sj.ok)) { $hubErrors += $pair[0]; continue }
        if ($failedHere -contains $pair[1]) { $notChecked += $pair[0]; continue }
        $asked++
        $missing += $failedHere
        $res = @($sj.results)
        $first3 = @($res | Select-Object -First 3 | ForEach-Object { [string]$_.site })
        if (-not ($first3 -contains $pair[1])) {
            $one = $res | Select-Object -First 1
            $shown = ''
            if ($one) { $nm = [string]$one.product_name; $shown = '{0} {1}' -f $one.site, $nm.Substring(0, [Math]::Min(40, $nm.Length)) }
            $wrongOrder += ('{0} (1o: {1})' -f $pair[0], $shown)
        }
        $notUk += @($res | Where-Object { $d = @($_.delivers_to | Where-Object { $_ }); $d.Count -gt 0 -and -not ($d -contains 'GB' -or $d -contains 'WORLD') }).Count
        Start-Sleep -Milliseconds 300
    }
    $missing = @($missing | Sort-Object -Unique)
    # A search that could not be checked is a warning only while it is one or two: with 3 or more (or fewer than 10
    # searches checked) the search itself may be broken, so it is a problem (the check of 7406b610).
    if ($notChecked.Count -ge 3 -or $asked -lt 10) { $hubErrors += ('{0} αναζητήσεις χωρίς έλεγχο' -f ($notChecked.Count + $hubErrors.Count)) }
    if ($wrongOrder.Count -eq 0 -and $notUk -eq 0 -and $hubErrors.Count -eq 0) { Say ('  Αναζήτηση (L177): {0} αναζητήσεις, η καθεμία βγάζει στα 3 πρώτα το site που το πουλά, όλα στέλνουν UK: ΕΝΤΑΞΕΙ' -f $asked) $Ok }
    elseif ($wrongOrder.Count -le 1 -and $notUk -eq 0 -and $hubErrors.Count -eq 0) { Say ('  Αναζήτηση (L177): ΠΡΟΣΟΧΗ - 1 από {0} με άλλη σειρά: {1}' -f $asked, ($wrongOrder -join '; ')) $Warn }
    else {
        $why = @()
        if ($wrongOrder.Count -gt 0) { $why += ('με λάθος σειρά: {0}' -f ($wrongOrder -join '; ')) }
        if ($notUk -gt 0) { $why += ('{0} προϊόντα που δεν στέλνουν UK' -f $notUk) }
        if ($hubErrors.Count -gt 0) { $why += ('η αναζήτηση του Hub δεν απάντησε δύο φορές: {0}' -f ($hubErrors -join ', ')) }
        Say ('  Αναζήτηση (L177): ΠΡΟΒΛΗΜΑ - {0}' -f ($why -join '; ')) $Bad
    }
    if ($notChecked.Count -gt 0) { Say ('  Αναζήτηση (L177): ΠΡΟΣΟΧΗ - δεν ελέγχθηκαν (το site τους δεν απάντησε δύο φορές, L74): {0}' -f ($notChecked -join ', ')) $Warn }
    if ($missing.Count -gt 0) { Say ('  Αναζήτηση (L177): ΠΡΟΣΟΧΗ - δεν απάντησαν κάποια φορά: {0} (το site, όχι το Hub)' -f ($missing -join ', ')) $Warn }
    # L180 (Idea 9): a search typed as a sentence, for a UK visitor. This tool is a bot for the Hub, so only the rules read
    # it (never the model, L106): the product and the price limit in pounds, the Gear World that was named comes first,
    # and a plain search stays as typed (no "understood"). Any of the three wrong is a problem (no live).
    $sentenceBad = @()
    $askSentence = {
        param([string]$q)
        $r = Get-Web ($base + '/api/search?q=' + [uri]::EscapeDataString($q) + '&country=GB&gwcheck=' + $stamp + '-s')
        try { return ((New-Object System.Text.UTF8Encoding($false)).GetString($r.bytes) | ConvertFrom-Json) } catch { return $null }
    }
    $pound = [string][char]0x00A3
    $sj1 = & $askSentence ('i want to buy a tablet under ' + $pound + '200')
    if (-not ($sj1 -and $sj1.ok -and $sj1.PSObject.Properties['understood'] -and [string]$sj1.understood.item -eq 'tablet' -and [double]$sj1.understood.max_price -eq 200)) { $sentenceBad += 'tablet under 200' }
    elseif (@($sj1.results | Where-Object { ([string]$_.currency -eq '' -or [string]$_.currency -eq 'GBP') -and [double]$_.price -gt 200 }).Count -gt 0) { $sentenceBad += 'tablet: price over 200' }
    $sj2 = & $askSentence 'perfume for her'
    $firstSite = ''
    if ($sj2 -and @($sj2.results).Count -gt 0) { $firstSite = [string](@($sj2.results)[0].site) }
    if (-not ($sj2 -and $sj2.ok -and $sj2.PSObject.Properties['understood'] -and [string]$sj2.understood.site -eq 'wgw' -and ($firstSite -eq '' -or $firstSite -eq 'wgw'))) { $sentenceBad += ('perfume for her (1' + [char]0x03BF + ': {0})' -f $firstSite) }
    $sj3 = & $askSentence 'kettle'
    if (-not ($sj3 -and $sj3.ok -and -not $sj3.PSObject.Properties['understood'])) { $sentenceBad += 'kettle' }
    if ($sentenceBad.Count -eq 0) { Say '  Αναζήτηση με πρόταση (L180): «i want to buy a tablet under £200» = tablet έως £200, «perfume for her» = πρώτα Women''s Gear World, το «kettle» μένει όπως γράφτηκε: ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  Αναζήτηση με πρόταση (L180): ΠΡΟΒΛΗΜΑ - {0}' -f ($sentenceBad -join '; ')) $Bad }
    $s = Get-Web ($base + '/api/search?q=suitcase&worlds=vgw&max_price=100')
    try {
        $j = (New-Object System.Text.UTF8Encoding($false)).GetString($s.bytes) | ConvertFrom-Json
        $items = @($j.results)
        $sitesSeen = @($items | ForEach-Object { [string]$_.site } | Sort-Object -Unique)
        $tooDear = @($items | Where-Object { [double]$_.price -gt 100 })
        $filtersOk = ($j.ok -and $j.filters -and (@($j.filters.worlds) -join ',') -eq 'vgw' -and [double]$j.filters.max_price -eq 100)
        if ($filtersOk -and ($sitesSeen.Count -eq 0 -or ($sitesSeen -join ',') -eq 'vgw') -and $tooDear.Count -eq 0) {
            Say ('  «Βρες δώρο» (Travel, έως £100, "suitcase"): {0} προϊόντα, μόνο από VGW και μέχρι £100: ΕΝΤΑΞΕΙ' -f $items.Count) $Ok
            # L153: how many of them say where their retailer delivers (delivers_to from the site, since its update of L151).
            $withShip = @($items | Where-Object { @($_.delivers_to | Where-Object { $_ }).Count -gt 0 })
            if ($items.Count -gt 0 -and $withShip.Count -eq $items.Count) { Say ('  Γραμμή «<κατάστημα> delivers to» (L153): και τα {0} προϊόντα έχουν χώρες παράδοσης: ΕΝΤΑΞΕΙ' -f $items.Count) $Ok }
            elseif ($items.Count -gt 0) { Say ('  Γραμμή «<κατάστημα> delivers to» (L153): {0} από {1} προϊόντα έχουν χώρες παράδοσης (το VGW δεν έχει ακόμα την έκδοση L151;)' -f $withShip.Count, $items.Count) $Warn }
        } else {
            Say ('  «Βρες δώρο»: ΠΡΟΒΛΗΜΑ - φίλτρα {0}, sites {1}, ακριβότερα από £100: {2}' -f $filtersOk, ($sitesSeen -join ','), $tooDear.Count) $Bad
        }
    } catch {
        Say ('  «Βρες δώρο»: ο έλεγχος δεν ολοκληρώθηκε ({0})' -f $_.Exception.Message) $Warn
    }
}

# IndexNow: the pages of the live sitemap (the gwh-sitemap Worker, read only), else the 6 pages it listed on 31/10/2026.
function Send-IndexNow {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $urls = @()
    $sm = Get-Web ($LiveUrl + '/sitemap.xml')
    if ($sm.status -eq 200) {
        $xml = (New-Object System.Text.UTF8Encoding($false)).GetString($sm.bytes)
        foreach ($m in [regex]::Matches($xml, '<loc>\s*(https://gearworldhub\.com/[^<\s]*)\s*</loc>')) { $urls += $m.Groups[1].Value }
    }
    if ($urls.Count -eq 0) { $urls = @('/', '/privacy/', '/terms/', '/cookies/', '/contact/', '/affiliate-disclosure/') | ForEach-Object { $LiveUrl + $_ } }
    $body = @{ host = 'gearworldhub.com'; key = $IndexNowKey; keyLocation = ($LiveUrl + '/' + $IndexNowKey + '.txt'); urlList = @($urls) } | ConvertTo-Json -Depth 3
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'https://api.indexnow.org/indexnow' -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 30
        $code = [int]$r.StatusCode
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    }
    if ($code -eq 200 -or $code -eq 202) { Say ('IndexNow: {0} σελίδες στάλθηκαν (απάντηση {1}): ΕΝΤΑΞΕΙ' -f $urls.Count, $code) $Ok; return $true }
    Say ('IndexNow: ΠΡΟΣΟΧΗ - απάντηση {0}. Το Hub είναι εντάξει· ξανατρέξε με -Step indexnow -Apply σε λίγα λεπτά.' -f $code) $Warn
    return $false
}

# No public test address for the live Hub (security fixes F04, lessons L106): its wrangler.toml has no routes (the domain is
# set in Cloudflare), so without these two lines every deploy switched gear-world-hub.<account>.workers.dev on again. The
# lines go right after the name line (top level, before the first [table]; at the very top when that line has another
# form). Returns the text unchanged when both are already false. Test-HubNoTestAddress says whether the top level
# really has both: the live step checks it after the change and stops before any deploy when it does not.
function Get-TomlTopLevel([string]$text) {
    $m = [regex]::Match($text, '(?m)^[ \t]*\[')
    if ($m.Success) { return $text.Substring(0, $m.Index) }
    return $text
}
function Test-HubNoTestAddress([string]$text) {
    $top = Get-TomlTopLevel $text
    $wd = @([regex]::Matches($top, '(?m)^workers_dev[ \t]*=.*$'))
    $pu = @([regex]::Matches($top, '(?m)^preview_urls[ \t]*=.*$'))
    if ($wd.Count -ne 1 -or $pu.Count -ne 1) { return $false }
    return (($wd[0].Value -match '^workers_dev[ \t]*=[ \t]*false[ \t]*(#.*)?\r?$') -and ($pu[0].Value -match '^preview_urls[ \t]*=[ \t]*false[ \t]*(#.*)?\r?$'))
}
function Set-HubNoTestAddress([string]$text) {
    $nl = $(if ($text.Contains("`r`n")) { "`r`n" } else { "`n" })
    $top = Get-TomlTopLevel $text
    $rest = $text.Substring($top.Length)
    $top = [regex]::Replace($top, '(?m)^workers_dev[ \t]*=[ \t]*true[ \t]*(?=\r?$)', 'workers_dev = false')
    $top = [regex]::Replace($top, '(?m)^preview_urls[ \t]*=[ \t]*true[ \t]*(?=\r?$)', 'preview_urls = false')
    $anchor = '(?m)^(name[ \t]*=[ \t]*"gear-world-hub"[ \t]*)(?=\r?$)'
    foreach ($key in @('preview_urls', 'workers_dev')) {
        if ($top -match ('(?m)^' + $key + '[ \t]*=')) { continue }
        if ($top -match $anchor) { $top = [regex]::Replace($top, $anchor, ('$1' + $nl + $key + ' = false')) }
        else { $top = $key + ' = false' + $nl + $top }
    }
    return $top + $rest
}

# Is everything ready for the security release (L106)? The Hub's Turnstile keys (names only) and, unless -NoHttpCheck,
# the 13 sites already sending the Turnstile token of their box (read-only GET of each home page).
function Get-SecurityReadiness([string]$folder) {
    $state = @{ secretsOk = $false; missing = @(); sitesChecked = $false; notReady = @() }
    $hs = Invoke-Wrangler $folder ('secret list --name {0}' -f $HubWorker) -Retry
    $list = Get-JsonArray $hs.text
    $names = @()
    if ($list) { $names = @($list | ForEach-Object { [string]$_.name }) }
    $state.missing = @($HubTurnstileSecrets | Where-Object { $names -notcontains $_ })
    $state.secretsOk = ($hs.code -eq 0 -and $null -ne $list -and $state.missing.Count -eq 0)
    if (-not $NoHttpCheck) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $state.sitesChecked = $true
        foreach ($sd in $SiteDomains) {
            $w = Get-Web ('https://' + $sd + '/?gwcheck=' + $stamp)
            $h = (New-Object System.Text.UTF8Encoding($false)).GetString($w.bytes)
            if ($w.status -ne 200 -or $h -notmatch 'data-du-turnstile') { $state.notReady += $sd }
        }
    }
    return $state
}

# ---------------- start ----------------
Say ('GWH HUB V2 («Συνδυασμός») - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
# L119: the Mitgo code as Mitgo gives it (a paste may add spaces or capitals); nothing of another form becomes a secret.
$MitgoCode = ([string]$MitgoCode).Trim().ToLowerInvariant()
$ImpactCode = ([string]$ImpactCode).Trim().ToLowerInvariant()
if ($ImpactCode -and $ImpactCode -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
    Say 'Ο κωδικός του Impact (-ImpactCode) δεν έχει τη μορφή που δίνει το Impact (8-4-4-4-12 ψηφία και γράμματα a-f): ΔΕΝ άλλαξε τίποτα. Στείλε στο Claude αυτή την αναφορά.' $Bad
    Finish 21
}
if ($MitgoCode -and $MitgoCode -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
    Say 'Ο κωδικός του Mitgo (-MitgoCode) δεν έχει τη μορφή που δίνει το Mitgo (8-4-4-4-12 ψηφία και γράμματα a-f): ΔΕΝ άλλαξε τίποτα. Στείλε στο Claude αυτή την αναφορά.' $Bad
    Finish 21
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }

if ($Step -eq 'indexnow') {
    Say 'Τι θα γίνει: ενημερώνω το IndexNow (Bing, Yandex κ.ά.) ότι οι σελίδες του sitemap του Hub άλλαξαν. Το Hub, η D1 και τα sites ΔΕΝ αλλάζουν.'
    if (-not $Apply) { Say 'Δοκιμή μόνο (χωρίς -Apply): δεν στάλθηκε τίποτα.' $Ok; Finish 0 }
    if ($NoHttpCheck) { Say 'Χωρίς δίκτυο (-NoHttpCheck): δεν στάλθηκε τίποτα.' $Warn; Finish 0 }
    if (Send-IndexNow) { Finish 0 } else { Finish 14 }
}

# 1. The version that runs live (live-baseline.txt) and the files of this version (the repo)
$baseline = @()
$liveLabel = 'live-baseline.txt'
if (-not $BaselineFile) { $BaselineFile = Join-Path (Join-Path (Join-Path $repo 'sites') 'gwh') 'live-baseline.txt' }
foreach ($line in [System.IO.File]::ReadAllLines($BaselineFile)) {
    if ($line -match '^\s*#\s*version:\s*(.+)$') { $liveLabel = $Matches[1].Trim(); continue }
    if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
    $p = $line -split ' \| '
    if ($p.Count -ge 4) { $baseline += @{ path = $p[0]; bytes = [long]$p[1]; sha = $p[2].ToLowerInvariant(); kind = $p[3] } }
}
if ($baseline.Count -eq 0) { Say 'Το live-baseline.txt είναι άδειο: ΔΕΝ αλλάζω τίποτα. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 13 }
$baseSha = @{}
foreach ($b in $baseline) { $baseSha[$b.path] = $b.sha }

$gwhRepo = Join-Path (Join-Path $repo 'sites') 'gwh'
$newFiles = @('worker.js', 'photo-search.js', 'poster-scan.js', 'mailerlite.js', 'members.js', 'security.js')
$pubRepo = Join-Path $gwhRepo 'public'
foreach ($f in @(Get-ChildItem -LiteralPath $pubRepo -Recurse -File | Sort-Object FullName)) {
    $newFiles += ('public/' + $f.FullName.Substring($pubRepo.Length).TrimStart('\', '/').Replace('\', '/'))
}
$newSha = @{}
foreach ($rel in $newFiles) { $newSha[$rel] = Get-FileSha (Local-Path $gwhRepo $rel) }
# The files this version changes or adds, compared with the version that runs live.
$plan = @($newFiles | Where-Object { -not $baseSha.ContainsKey($_) -or $baseSha[$_] -ne $newSha[$_] })

# 2. The hub folder on this PC: still the version that runs live, or already this version?
$cfgPc = Join-Path $HubDir 'wrangler.toml'
if (-not (Test-Path -LiteralPath $cfgPc)) { Say ('Δεν βρήκα το Hub στον υπολογιστή ({0}). Στείλε στο Claude αυτό το μήνυμα.' -f $HubDir) $Bad; Finish 2 }
$cfgText = [System.IO.File]::ReadAllText($cfgPc)
if ($cfgText -notmatch ('(?m)^\s*name\s*=\s*"{0}"' -f $HubWorker)) { Say 'Το wrangler.toml του Hub δεν είναι αυτό που περίμενα: σταμάτησα.' $Bad; Finish 2 }
$postersOn = ($cfgText -match '(?m)^\s*binding\s*=\s*"POSTERS"')
$pub = Join-Path $HubDir 'public'
$pcFiles = @()
if (Test-Path -LiteralPath $pub) {
    foreach ($f in @(Get-ChildItem -LiteralPath $pub -Recurse -File)) {
        $pcFiles += ('public/' + $f.FullName.Substring($pub.Length).TrimStart('\', '/').Replace('\', '/'))
    }
}
$changed = @()
foreach ($b in $baseline) {
    $sha = Get-FileSha (Local-Path $HubDir $b.path)
    if (-not $sha) { $changed += ($b.path + ' (λείπει)') } elseif ($sha -ne $b.sha) { $changed += $b.path }
}
$notNew = @()
foreach ($rel in $newFiles) { if ((Get-FileSha (Local-Path $HubDir $rel)) -ne $newSha[$rel]) { $notNew += $rel } }
$extraBase = @($pcFiles | Where-Object { -not $baseSha.ContainsKey($_) })
$extraAll = @($pcFiles | Where-Object { -not $baseSha.ContainsKey($_) -and -not $newSha.ContainsKey($_) })
$pcIsBaseline = ($changed.Count -eq 0 -and $extraBase.Count -eq 0)
$pcIsNew = ($notNew.Count -eq 0 -and $extraAll.Count -eq 0)
if ($pcIsBaseline -and $plan.Count -gt 0) {
    Say ('Φάκελος του Hub στον υπολογιστή: ίδιος με την έκδοση που τρέχει live ({0}, {1} αρχεία): ΕΝΤΑΞΕΙ' -f $liveLabel, $baseline.Count) $Ok
} elseif ($pcIsNew) {
    Say ('Φάκελος του Hub στον υπολογιστή: έχει ήδη αυτή την έκδοση ({0} αρχεία): ΕΝΤΑΞΕΙ' -f $newFiles.Count) $Ok
} else {
    Say ('Φάκελος του Hub στον υπολογιστή: ΠΡΟΒΛΗΜΑ - άλλαξε μετά την έκδοση {0}, και δεν είναι ούτε αυτή η έκδοση:' -f $liveLabel) $Bad
    foreach ($c in $changed) { Say ('  - άλλαξε: ' + $c) }
    foreach ($x in $extraBase) { Say ('  - νέο αρχείο: ' + $x) }
}
if ($postersOn) { Say 'Μέτρηση αφισών (POSTERS) στη ρύθμιση του Hub: υπάρχει: ΕΝΤΑΞΕΙ' $Ok }
else { Say 'Μέτρηση αφισών (POSTERS) στη ρύθμιση του Hub: ΔΕΝ υπάρχει ακόμα. Πρώτα το «ΕΓΚΡΙΝΩ POSTER STATS» (το preview μπορεί να γίνει από τώρα).' $Warn }

# 3. The live gearworldhub.com, read like a browser: still the version of the baseline, or already this version?
$liveState = 'unknown'
$unread = @()
if (-not $NoHttpCheck) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    # robots.txt is not compared: Cloudflare puts its managed Content Signals above the Hub's own lines (Test-Site reads it).
    $paths = @(@($baseline | Where-Object { $_.path -like 'public/*' } | ForEach-Object { $_.path }) + @($newFiles | Where-Object { $_ -like 'public/*' }) | Where-Object { $_ -ne 'public/robots.txt' } | Sort-Object -Unique)
    $isBase = $true
    $isNew = $true
    $diff = @()
    foreach ($rel in $paths) {
        $sha = Get-LiveSha ($LiveUrl + (Get-UrlPath $rel) + '?gwcheck=' + $stamp) ($rel -match '\.html$')
        if ($sha -eq 'error') { $unread += $rel; continue }
        $okBase = ($baseSha.ContainsKey($rel) -and $sha -eq $baseSha[$rel]) -or (-not $baseSha.ContainsKey($rel) -and $sha -eq 'missing')
        $okNew = ($newSha.ContainsKey($rel) -and $sha -eq $newSha[$rel])
        if (-not $okBase) { $isBase = $false }
        if ($newSha.ContainsKey($rel) -and -not $okNew) { $isNew = $false }
        if (-not $okBase -and -not $okNew) { $diff += $rel }
    }
    if ($unread.Count -gt 0) {
        Say 'Live gearworldhub.com: ΠΡΟΣΟΧΗ - δεν μπόρεσα να διαβάσω κάποια αρχεία (δίκτυο;). Ξανατρέξε την εντολή σε λίγο:' $Warn
        foreach ($x in $unread) { Say ('  - ' + $x) }
    } else {
        if ($isBase) { $liveState = 'baseline' } elseif ($isNew) { $liveState = 'new' } else { $liveState = 'mixed' }
        if ($liveState -eq 'baseline') { Say ('Live gearworldhub.com: ίδιο με την έκδοση {0} ({1} αρχεία της σελίδας): ΕΝΤΑΞΕΙ' -f $liveLabel, $paths.Count) $Ok }
        elseif ($liveState -eq 'new') { Say ('Live gearworldhub.com: έχει ήδη αυτή την έκδοση ({0} αρχεία της σελίδας): ΕΝΤΑΞΕΙ' -f $paths.Count) $Ok }
        else {
            Say ('Live gearworldhub.com: ΠΡΟΒΛΗΜΑ - δεν είναι ούτε η έκδοση {0} ούτε αυτή η έκδοση. Αρχεία:' -f $liveLabel) $Bad
            foreach ($x in $diff) { Say ('  - ' + $x) }
        }
    }
}

# 4. Cloudflare login and the live version of the Worker (read-only)
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$gwh = Join-Path (Join-Path $deploy 'sites') 'gwh'
$who = Invoke-Wrangler $gwh 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' $Bad }
    else { Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' $Bad }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' $Ok
$liveVersion = Get-LiveVersion $gwh $HubWorker
if ($liveVersion) { Say ('Ζωντανή έκδοση του Worker "{0}": βρέθηκε (για επαναφορά): ΕΝΤΑΞΕΙ' -f $HubWorker) $Ok }
else { Say ('Ζωντανή έκδοση του Worker "{0}": ΠΡΟΒΛΗΜΑ - δεν τη βρήκα (χρειάζεται για επαναφορά)' -f $HubWorker) $Bad }

# ---------------- register: Pets Gear World in the Hub's list of sites (D1 gear-world-registry) ----------------
if ($Step -eq 'register') {
    Say ''
    Say 'Τι θα γίνει:'
    Say '  - Μία νέα γραμμή στη D1 του Hub (πίνακας sites): ZGW, Pets Gear World, petsgearworld.com.'
    Say '  - Έτσι η αναζήτηση του Hub (και με φωτογραφία) ψάχνει και στο Pets. Οι άλλες γραμμές ΔΕΝ αλλάζουν.'
    Say '  - Πρώτα σημείο επαναφοράς (Cloudflare Time Travel) της D1 του Hub.'
    $dl = Invoke-Wrangler $gwh 'd1 list --json' -Retry
    $list = Get-JsonArray $dl.text
    $dbId = ''
    if ($list) { foreach ($d in $list) { if ($d.name -eq $DbName) { $dbId = [string]$d.uuid } } }
    if (-not $dbId) { Say ('Δεν βρήκα τη D1 "{0}". Δεν αλλάζω τίποτα.' -f $DbName) $Bad; Finish 5 }
    $q = Invoke-Wrangler $gwh ('d1 execute {0} --remote --json --command "SELECT site_key FROM sites WHERE site_key = ''ZGW'' OR domain = ''petsgearworld.com''"' -f $DbName) -Retry
    if ($q.code -ne 0) { Say 'Δεν μπόρεσα να διαβάσω τη λίστα sites του Hub. Δεν αλλάζω τίποτα. Έξοδος:' $Bad; Say $q.text; Finish 5 }
    if ($q.text -match '"site_key"\s*:\s*"ZGW"') { Say 'Το Pets (ZGW) είναι ήδη στη λίστα sites του Hub: τίποτα να αλλάξω.' $Ok; Finish 0 }
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $PhraseRegister)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }
    $bdir = Join-Path $WorkDir 'backups'
    if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
    $tt = Invoke-Wrangler $gwh ('d1 time-travel info {0}' -f $DbName) -Retry
    $bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
    if (-not $bm.Success) { Say 'Δεν βρήκα σημείο επαναφοράς της D1 του Hub: για ασφάλεια ΔΕΝ αλλάζω τίποτα.' $Bad; Finish 11 }
    $note = @(
        ('Hub D1 restore point before adding Pets Gear World (ZGW), {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        'To go back (only with approval), in PowerShell:',
        ('  npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value),
        "Or remove only the new row: npx wrangler d1 execute $DbName --remote --command `"DELETE FROM sites WHERE site_key = 'ZGW'`""
    ) -join "`r`n"
    $noteFile = Join-Path $bdir ('gwh-registry-before-zgw-' + $stamp + '.txt')
    [System.IO.File]::WriteAllText($noteFile, $note, (New-Object System.Text.UTF8Encoding($false)))
    Say ('Σημείο επαναφοράς: {0}' -f $noteFile) $Ok
    $sql = Join-Path $bdir ('add-zgw-site-' + $stamp + '.sql')
    # OR IGNORE: site_key and domain are UNIQUE, so running it twice never adds a second row.
    $sqlText = @(
        "INSERT OR IGNORE INTO sites (site_key, site_name, domain, audience, destination_db, destination_worker, priority, is_active)",
        "VALUES ('ZGW', 'Pets Gear World', 'petsgearworld.com', 'pets', 'pets-gear-world', 'pets-gear-world', (SELECT COALESCE(MAX(priority), 0) + 10 FROM sites), 1);"
    ) -join "`n"
    [System.IO.File]::WriteAllText($sql, $sqlText + "`n", (New-Object System.Text.UTF8Encoding($false)))
    $x = Invoke-Wrangler $gwh ('d1 execute {0} --remote --file "{1}"' -f $DbName, $sql) -Retry
    if ($x.code -ne 0) { Say 'Η γραμμή του Pets στη D1 του Hub δεν μπήκε. Τίποτα άλλο δεν άλλαξε. Έξοδος:' $Bad; Say $x.text; Finish 12 }
    $v = Invoke-Wrangler $gwh ('d1 execute {0} --remote --json --command "SELECT site_key FROM sites WHERE site_key = ''ZGW''"' -f $DbName) -Retry
    if ($v.text -notmatch '"site_key"\s*:\s*"ZGW"') { Say 'Η γραμμή γράφτηκε αλλά δεν τη βρίσκω: στείλε αυτή την αναφορά στο Claude.' $Warn; Finish 12 }
    Say 'Το Pets (ZGW) μπήκε στη λίστα sites του Hub: η αναζήτηση του gearworldhub.com ψάχνει τώρα και εκεί.' $Ok
    if (-not $NoHttpCheck) {
        Start-Sleep -Seconds 5
        $s = Get-Web ($LiveUrl + '/api/search?q=dog&worlds=zgw')
        try {
            $j = (New-Object System.Text.UTF8Encoding($false)).GetString($s.bytes) | ConvertFrom-Json
            $n = @($j.results).Count
            if ($j.ok -and $n -gt 0) { Say ('  Αναζήτηση Hub στο Pets ("dog"): {0} προϊόντα: ΕΝΤΑΞΕΙ' -f $n) $Ok }
            else { Say '  Αναζήτηση Hub στο Pets: 0 προϊόντα ακόμα (ξαναδές σε 1 λεπτό).' $Warn }
        } catch { Say ('  Αναζήτηση Hub στο Pets: ο έλεγχος δεν ολοκληρώθηκε ({0})' -f $_.Exception.Message) $Warn }
    }
    Finish 0
}

# ---------------- remove-preview: the test Worker goes (owner, 29/10/2026) ----------------
if ($Step -eq 'remove-preview') {
    Say ''
    Say 'Τι θα γίνει:'
    Say ('  - Σβήνεται ΜΟΝΟ ο δοκιμαστικός Worker "{0}" (η διεύθυνση *.workers.dev παύει να ανοίγει).' -f $PreviewName)
    Say ('  - Το gearworldhub.com, ο Worker "{0}", η D1 και τα sites ΔΕΝ αλλάζουν.' -f $HubWorker)
    Say '  - Αν τον ξαναχρειαστούμε: το βήμα preview τον φτιάχνει ξανά σε 1 λεπτό.'
    if ($PreviewName -eq $HubWorker -or $PreviewName -notmatch '-preview$') { Say 'Λάθος όνομα δοκιμαστικού Worker: δεν σβήνω τίποτα.' $Bad; Finish 12 }
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $PhraseRemovePreview)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }
    # A new empty folder for every run, so no wrangler config can be there and only the Worker named here is meant (L83).
    $empty = Join-Path $WorkDir ('empty-for-delete-' + $stamp)
    if (Test-Path -LiteralPath $empty) { Say ('Ο φάκελος {0} υπάρχει ήδη: δεν σβήνω τίποτα.' -f $empty) $Bad; Finish 12 }
    New-Item -ItemType Directory -Path $empty -Force | Out-Null
    $d = Invoke-Wrangler $empty ('delete {0}' -f $PreviewName)
    Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
    if ($d.code -ne 0) {
        if ($d.text -match '(?i)not found|does not exist|10007') { Say ('Ο δοκιμαστικός Worker "{0}" δεν υπάρχει ήδη: τίποτα να σβήσω.' -f $PreviewName) $Ok; Finish 0 }
        Say 'Το σβήσιμο απέτυχε. Τίποτα άλλο δεν άλλαξε. Έξοδος:' $Bad; Say $d.text; Finish 9
    }
    Say ('Σβήστηκε ο δοκιμαστικός Worker "{0}". Το gearworldhub.com δεν άλλαξε.' -f $PreviewName) $Ok
    Finish 0
}

# 5. The plan
Say ''
Say ('Preview (φράση {0}): ο δοκιμαστικός Worker "{1}" σε διεύθυνση *.workers.dev παίρνει αυτή την έκδοση.' -f $PhrasePreview, $PreviewName)
Say '  noindex, χωρίς Google Analytics, η εγγραφή email κλειστή, χωρίς μέτρηση αφισών. Το live gearworldhub.com ΔΕΝ αλλάζει.'
if ($MitgoCode) { Say '  Ο κωδικός του Mitgo μπαίνει και στον δοκιμαστικό Worker, για να φανεί εκεί πρώτα η ετικέτα.' }
if ($ImpactCode) { Say '  Ο κωδικός του Impact μπαίνει και στον δοκιμαστικό Worker, για να φανεί εκεί πρώτα η ετικέτα.' }
Say ('  Επαναφορά (μόνο με έγκριση): npx wrangler delete --name {0}' -f $PreviewName)
if ($plan.Count -eq 0) {
    Say 'Αυτή η έκδοση του κώδικα είναι ήδη η live έκδοση (live-baseline.txt): για το live δεν έχει τίποτα να αλλάξει.' $Ok
} else {
    Say ('Live (φράση {0}):' -f $PhraseLive)
    Say '  1. Αντίγραφο ασφαλείας: zip του φακέλου του Hub (κώδικας, wrangler.toml, public) και ο αριθμός της ζωντανής έκδοσης.'
    Say ('  2. Στον φάκελο του Hub μπαίνουν {0} αρχεία αυτής της έκδοσης:' -f $plan.Count)
    foreach ($rel in $plan) {
        $what = $(if ($About.ContainsKey($rel)) { $About[$rel] } else { 'νέα έκδοση του αρχείου' })
        Say ('     - {0}: {1}' -f $rel, $what)
    }
    Say '  3. Στο wrangler.toml του Hub: workers_dev = false και preview_urls = false (κλείνει η δοκιμαστική διεύθυνση gear-world-hub.<λογαριασμός>.workers.dev του live Hub, F04). Το παλιό wrangler.toml μένει στο zip και στα αρχεία επαναφοράς.'
    if ($MitgoCode) { Say ('  4. Ο κωδικός επαλήθευσης του Mitgo γίνεται το μυστικό MITGO_VERIFICATION του Worker "{0}" (ποτέ στο GitHub ή σε αναφορά)· ο νέος κώδικας βάζει την ετικέτα <meta name="mitgo-verification"> στο <head> της αρχικής.' -f $HubWorker) }
    if ($ImpactCode) { Say ('  4. Ο κωδικός επαλήθευσης του Impact γίνεται το μυστικό IMPACT_VERIFICATION του Worker "{0}" (ποτέ στο GitHub ή σε αναφορά)· ο νέος κώδικας βάζει την ετικέτα <meta name=''impact-site-verification''> στο <head> της αρχικής, μετά του Mitgo.' -f $HubWorker) }
    Say ('  {0}. Deploy του gearworldhub.com από τον φάκελο του Hub (με το δικό του wrangler.toml), και έλεγχος της σελίδας και του «Βρες δώρο».' -f $(if ($MitgoCode -or $ImpactCode) { 5 } else { 4 }))
    if ($AfterPreview) { Say '  Με -AfterPreview: το live γίνεται μόνο αν το preview αυτής της έκδοσης, τις τελευταίες 2 ώρες, τελείωσε ΕΤΟΙΜΟ χωρίς ΠΡΟΒΛΗΜΑ.' }
    Say '  Η D1, τα 11 sites και οι άλλοι Workers (και ο gwh-sitemap) ΔΕΝ αλλάζουν.'
    Say ('  Επαναφορά (μόνο με έγκριση): npx wrangler rollback <ζωντανή έκδοση> --name {0}, και τα αρχεία του zip πίσω στον φάκελο του Hub.' -f $HubWorker)
    if ($MitgoCode) { Say ('  Αφαίρεση της ετικέτας Mitgo (μόνο με έγκριση): npx wrangler secret delete MITGO_VERIFICATION --name {0}' -f $HubWorker) }
    if ($ImpactCode) { Say ('  Αφαίρεση της ετικέτας Impact (μόνο με έγκριση): npx wrangler secret delete IMPACT_VERIFICATION --name {0}' -f $HubWorker) }
    Say '  Επαναφορά όλης της έκδοσης L106: ΠΡΩΤΑ το Hub (αυτό), ΜΕΤΑ τα 13 sites: το νέο Hub δεν δέχεται εγγραφή χωρίς Turnstile, και ο παλιός κώδικας των sites δεν στέλνει.'
}
$readyLive = (($pcIsBaseline -or $pcIsNew) -and ($liveState -eq 'baseline' -or $liveState -eq 'new' -or ($NoHttpCheck -and $liveState -eq 'unknown')) -and $liveVersion -and $postersOn)
# Security fixes (L106): the Hub checks Turnstile tokens from now on, so its keys must be there and the 13 sites must
# already send the token of their box. Asked in check and live only (never changes anything).
$security = $null
if (($Step -eq 'check' -or $Step -eq 'live') -and $plan -contains 'security.js') {
    $security = Get-SecurityReadiness $gwh
    if ($security.secretsOk) { Say ('Κλειδιά Turnstile του Hub ({0}): υπάρχουν: ΕΝΤΑΞΕΙ' -f ($HubTurnstileSecrets -join ', ')) $Ok }
    else { Say ('Κλειδιά Turnstile του Hub: ΠΡΟΒΛΗΜΑ - λείπουν: {0}. Πρώτα το tools/gw-security-fixes.ps1 -Step turnstile («ΕΓΚΡΙΝΩ TURNSTILE»).' -f $(if ($security.missing.Count) { $security.missing -join ', ' } else { '(δεν διαβάστηκαν)' })) $Bad }
    if ($security.sitesChecked) {
        if ($security.notReady.Count -eq 0) { Say ('Τα {0} sites στέλνουν το token του Turnstile από τη φόρμα «Get deal updates»: ΕΝΤΑΞΕΙ' -f $SiteDomains.Count) $Ok }
        else { Say ('Τα sites που ΔΕΝ στέλνουν ακόμα το token του Turnstile: {0}. ΠΡΟΒΛΗΜΑ - πρώτα το tools/ads-fixes-sites.ps1 -Step apply («ΕΓΚΡΙΝΩ ADS FIXES»).' -f ($security.notReady -join ', ')) $Bad }
    }
    $readyLive = ($readyLive -and $security.secretsOk -and $security.notReady.Count -eq 0)
}

if ($Step -eq 'check') {
    Say ''
    if ($readyLive) { Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ - έτοιμο για το preview και για το live. Μόνο έλεγχος: δεν άλλαξε τίποτα.' $Ok }
    else { Say 'Αποτέλεσμα: το preview μπορεί να γίνει. Για το live κάτι από τα παραπάνω δεν είναι έτοιμο (δες ΠΡΟΒΛΗΜΑ/ΠΡΟΣΟΧΗ). Μόνο έλεγχος: δεν άλλαξε τίποτα.' $Warn }
    Finish 0
}

# ---------------- preview ----------------
if ($Step -eq 'preview') {
    $dl = Invoke-Wrangler $gwh 'd1 list --json' -Retry
    $list = Get-JsonArray $dl.text
    $dbId = ''
    if ($list) { foreach ($d in $list) { if ($d.name -eq $DbName) { $dbId = [string]$d.uuid } } }
    if (-not $dbId) { Say ('Δεν βρήκα τη D1 "{0}". Δεν αλλάζω τίποτα.' -f $DbName) $Bad; Finish 5 }
    # L107: the products the gift guides link to, from the live D1 of their sites (SELECT only); the preview only reports.
    Say-GuideProducts (Test-GuideProducts $deploy)
    Say-Stores (Test-Stores)
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $PhrasePreview)) { Say 'Δεν δόθηκε η έγκριση για το preview: σταμάτησα (δεν ανέβηκε τίποτα).' $Warn; Finish 1 }
    $cfg = Write-PreviewConfig $gwh $dbId
    $d = Invoke-Deploy $gwh $cfg
    if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε. Το live Hub δεν άλλαξε. Έξοδος:' $Bad; Say $d.text; Finish 9 }
    $um = [regex]::Match($d.text, 'https://[A-Za-z0-9\.\-]+\.workers\.dev')
    $url = $(if ($um.Success) { $um.Value } else { '' })
    $sl = Invoke-Wrangler $gwh ('secret list --name {0} --format pretty' -f $PreviewName) -Retry
    if ($sl.code -eq 0 -and $sl.text -match 'Secret Name:\s*PHOTO_LIMIT_SALT') {
        Say 'Το μυστικό της αναζήτησης με φωτογραφία στο preview υπάρχει ήδη, έμεινε ίδιο.'
    } else {
        $s = Set-PreviewSecret $gwh
        if ($s.code -ne 0) { Say 'Το μυστικό του preview δεν μπήκε: η αναζήτηση με φωτογραφία εκεί θα απαντά "not ready". Τα υπόλοιπα δουλεύουν.' $Warn }
        else { Say 'Μυστικό για την αναζήτηση με φωτογραφία στο preview: μπήκε (τυχαίο, δεν φαίνεται πουθενά).' $Ok }
    }
    # L119: the Mitgo code on the test Worker too, so the tag is seen there first.
    if ($MitgoCode) {
        $ms = Set-WorkerSecret $gwh $PreviewName 'MITGO_VERIFICATION' $MitgoCode
        if ($ms.code -ne 0) { Say 'Ο κωδικός του Mitgo στο preview: ΠΡΟΒΛΗΜΑ - δεν μπήκε, άρα το live με -AfterPreview δεν θα γίνει. Στείλε στο Claude αυτή την αναφορά.' $Bad }
        else { Say 'Ο κωδικός επαλήθευσης του Mitgo μπήκε στο preview (μυστικό MITGO_VERIFICATION του δοκιμαστικού Worker, δεν φαίνεται πουθενά).' $Ok }
    }
    # L150: the Impact code on the test Worker too.
    if ($ImpactCode) {
        $is = Set-WorkerSecret $gwh $PreviewName 'IMPACT_VERIFICATION' $ImpactCode
        if ($is.code -ne 0) { Say 'Ο κωδικός του Impact στο preview: ΠΡΟΒΛΗΜΑ - δεν μπήκε, άρα το live με -AfterPreview δεν θα γίνει. Στείλε στο Claude αυτή την αναφορά.' $Bad }
        else { Say 'Ο κωδικός επαλήθευσης του Impact μπήκε στο preview (μυστικό IMPACT_VERIFICATION του δοκιμαστικού Worker, δεν φαίνεται πουθενά).' $Ok }
    }
    Say ('Ανέβηκε. Δοκιμαστική διεύθυνση: {0}' -f $(if ($url) { $url } else { '(δεν τη βρήκα στην έξοδο)' })) $Ok
    # The Black Friday link only while Black Friday is switched on in hub-v2.js (promos.js SEASONS_ON, lessons L107).
    $bfOn = ([System.IO.File]::ReadAllText((Join-Path (Join-Path $gwh 'public') 'hub-v2.js')) -match '"black-friday":\s*true')
    if ($url -and $bfOn) { Say ('Για να δεις το μπάνερ της Black Friday πριν τις 27/11: {0}/?gwh-date=2026-11-28' -f $url) }
    elseif ($url) { Say 'Η Black Friday είναι ΚΛΕΙΣΤΗ (promos.js): η δοκιμαστική διεύθυνση δείχνει τη σελίδα όπως θα βγει live, χωρίς μπάνερ Black Friday.' }
    if ($url -and -not $NoHttpCheck) { Start-Sleep -Seconds 8; Test-Site $url $false }
    Say ''
    Say 'ΕΤΟΙΜΟ: άνοιξε τη δοκιμαστική διεύθυνση στο κινητό σου. Το live gearworldhub.com δεν άλλαξε.' $Ok
    Finish 0
}

# ---------------- live ----------------
if ($plan.Count -eq 0) { Say 'Τίποτα να αλλάξει στο live.' $Ok; Finish 0 }
if (-not $pcIsBaseline -and -not $pcIsNew) {
    Say ('Ο φάκελος του Hub στον υπολογιστή δεν είναι ούτε η έκδοση {0} ούτε αυτή η έκδοση: κάποιος τον άλλαξε. ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' -f $liveLabel) $Bad
    Finish 7
}
if (-not $postersOn) { Say 'Πρώτα η μέτρηση των αφισών (ΕΓΚΡΙΝΩ POSTER STATS), μετά το νέο Hub: ΔΕΝ αλλάζω τίποτα.' $Bad; Finish 8 }
# The member list (lessons L92): the new code writes new columns of hub_subscribers, so they must be there first.
if ($plan -contains 'members.js') {
    $mq = Invoke-Wrangler $gwh ('d1 execute {0} --remote --json --command "PRAGMA table_info(hub_subscribers)"' -f $DbName) -Retry
    if ($mq.code -ne 0 -or $mq.text -notmatch '"member_source"' -or $mq.text -notmatch '"ml_status"') { Say 'Πρώτα η λίστα μελών στη βάση του Hub (ΕΓΚΡΙΝΩ HUB MEMBERS, tools/hub-members.ps1), μετά το νέο Hub: ΔΕΝ αλλάζω τίποτα.' $Bad; Finish 15 }
    Say 'Λίστα μελών στη βάση του Hub (νέα πεδία): υπάρχει: ΕΝΤΑΞΕΙ' $Ok
}
if ($unread.Count -gt 0) { Say 'Δεν μπόρεσα να διαβάσω όλο το live gearworldhub.com: ΔΕΝ αλλάζω τίποτα. Ξανατρέξε την εντολή σε λίγο.' $Bad; Finish 6 }
if ($liveState -eq 'mixed') { Say 'Το live gearworldhub.com άλλαξε από αλλού: ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' $Bad; Finish 7 }
if ($pcIsNew -and $liveState -eq 'new') {
    Say ''
    Say 'Το νέο Hub είναι ήδη live και ο φάκελος του υπολογιστή είναι ίδιος. Τίποτα να κάνω.' $Ok
    Finish 0
}
if (-not $liveVersion) {
    Say ('Δεν βρήκα τη ζωντανή έκδοση του Worker "{0}" (χρειάζεται για επαναφορά): για ασφάλεια ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' -f $HubWorker) $Bad
    Finish 11
}
# L107: no gift guide may link to a product whose page would show a notice (live D1 of each site, SELECT only).
$guideCheck = Test-GuideProducts $deploy
Say-GuideProducts $guideCheck
if (-not $guideCheck.ok -or $guideCheck.notices -gt 0) { Say 'ΔΕΝ ανεβάζω το Hub: πρώτα νέα προϊόντα στο sites/gwh/guides/guides.json (Claude), μετά ξανά αυτό το βήμα. ΔΕΝ άλλαξε τίποτα.' $Bad; Finish 20 }
# L109: a gift guide price that is not the price its site shows stops the live step too (OLD stays a warning).
if ($guideCheck.prices -gt 0) { Say 'ΔΕΝ ανεβάζω το Hub: οι τιμές κάποιων οδηγών δώρων δεν είναι ίδιες με τις τιμές των sites (δες PRICE). Τίποτα δεν ανέβηκε live και τίποτα δεν άλλαξε. Στείλε αυτή την αναφορά στο Claude: θα ενημερώσει τις τιμές των οδηγών και θα σου δώσει νέα εντολή.' $Bad; Finish 20 }
# L166: no Stores page may name a code or sale that has ended (UK day).
$storesCheck = Test-Stores
Say-Stores $storesCheck
if (-not $storesCheck.ok) { Say 'ΔΕΝ ανεβάζω το Hub: πρώτα νέες σελίδες Stores χωρίς όσα έληξαν (Claude: stores.json και node tools/gwh-stores.mjs build). Τίποτα δεν ανέβηκε live και τίποτα δεν άλλαξε.' $Bad; Finish 24 }
# L119: preview, live and remove-preview in one paste: the live step goes on only after a clean preview of this version.
if ($AfterPreview -and -not (Test-PreviewReport)) { Finish 23 }
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
if (-not (Confirm-Approval $PhraseLive)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }
if ($null -ne $security) {
    if (-not $security.secretsOk) { Say 'Το Hub δεν έχει ακόμα τα κλειδιά Turnstile: πρώτα το tools/gw-security-fixes.ps1 -Step turnstile («ΕΓΚΡΙΝΩ TURNSTILE»). ΔΕΝ άλλαξε τίποτα.' $Bad; Finish 16 }
    if ($security.notReady.Count -gt 0) { Say ('Τα sites {0} δεν στέλνουν ακόμα το token του Turnstile: πρώτα το tools/ads-fixes-sites.ps1 -Step apply («ΕΓΚΡΙΝΩ ADS FIXES»), αλλιώς οι εγγραφές τους θα απορρίπτονταν. ΔΕΝ άλλαξε τίποτα.' -f ($security.notReady -join ', ')) $Bad; Finish 17 }
}

# 1. Backup first: the whole hub folder that goes live (zip), and the files that change as plain copies
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
$tmpCopy = Join-Path ([System.IO.Path]::GetTempPath()) ('gwh-before-v2-' + $stamp)
New-Item -ItemType Directory -Path $tmpCopy -Force | Out-Null
foreach ($n in @('worker.js', 'wrangler.toml', 'photo-search.js', 'poster-scan.js', 'mailerlite.js', 'members.js', 'security.js')) {
    $src = Join-Path $HubDir $n
    if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $tmpCopy -Force }
}
Copy-Item -LiteralPath $pub -Destination $tmpCopy -Recurse -Force
$zip = Join-Path $bdir ('gwh-before-v2-live-' + $stamp + '.zip')
Compress-Archive -Path (Join-Path $tmpCopy '*') -DestinationPath $zip -Force
Remove-Item -LiteralPath $tmpCopy -Recurse -Force
if (-not (Test-Path -LiteralPath $zip)) { Say 'Το αντίγραφο ασφαλείας δεν γράφτηκε: ΔΕΝ άλλαξα τίποτα.' $Bad; Finish 11 }
$keep = Join-Path $bdir ('gwh-before-v2-files-' + $stamp)
$hadBefore = @{}
foreach ($rel in $plan) {
    $src = Local-Path $HubDir $rel
    $hadBefore[$rel] = (Test-Path -LiteralPath $src -PathType Leaf)
    if ($hadBefore[$rel]) {
        $dst = Local-Path $keep $rel
        New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
        Copy-Item -LiteralPath $src -Destination $dst -Force
    }
}
$note = @(
    ('Gear World Hub before the Hub V2 went live ({0}), {1}' -f (Split-Path -Leaf $repo), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('Live version before: {0}' -f $liveVersion),
    ('Hub folder before (code, wrangler.toml, public): {0}' -f $zip),
    ('The {0} files that changed, as they were: {1}' -f $plan.Count, $keep),
    'Files that are new in this version (delete them when going back): ',
    ('  ' + ((@($plan | Where-Object { -not $hadBefore[$_] })) -join ', ')),
    'To go back (only with approval), in PowerShell:',
    ('  npx wrangler rollback {0} --name {1}' -f $liveVersion, $HubWorker),
    ('  then put the files of {0} back into {1}' -f $keep, $HubDir),
    'Or in the Cloudflare dashboard: Workers > gear-world-hub > Deployments > the version above > Rollback.',
    'Going back from the whole L106 release: the Hub FIRST (this), THEN the 13 sites (the new Hub refuses sign-ups without Turnstile, the older site code sends none).'
) -join "`r`n"
if ($ImpactCode) { $note += "`r`n" + ('The Impact tag (L150) is the Worker secret IMPACT_VERIFICATION. To take it away (only with approval): npx wrangler secret delete IMPACT_VERIFICATION --name {0}' -f $HubWorker) }
if ($MitgoCode) { $note += "`r`n" + ('The Mitgo tag (L119) is the Worker secret MITGO_VERIFICATION. To take it away (only with approval): npx wrangler secret delete MITGO_VERIFICATION --name {0}' -f $HubWorker) }
$noteFile = Join-Path $bdir ('gwh-before-v2-live-' + $stamp + '.txt')
[System.IO.File]::WriteAllText($noteFile, $note, (New-Object System.Text.UTF8Encoding($false)))
Say ('Αντίγραφο ασφαλείας και οδηγίες επαναφοράς: {0}' -f $noteFile) $Ok

# F04 (lessons L106): workers.dev and the preview URLs off in the Hub's wrangler.toml on this PC (the zip above has the old one).
[byte[]]$tomlBytes = [System.IO.File]::ReadAllBytes($cfgPc)
$tomlBefore = [System.IO.File]::ReadAllText($cfgPc)
$tomlSafe = Set-HubNoTestAddress $tomlBefore
$tomlChanged = ($tomlSafe -ne $tomlBefore)
if (-not (Test-HubNoTestAddress $tomlSafe)) {
    Say ('ΠΡΟΒΛΗΜΑ: δεν μπόρεσα να γράψω workers_dev = false και preview_urls = false στην αρχή του wrangler.toml του Hub ({0}): μια από αυτές τις γραμμές έχει άλλη μορφή. Χωρίς αυτές το live Hub θα άνοιγε ξανά στο *.workers.dev. ΔΕΝ άλλαξε τίποτα και δεν ανέβηκε τίποτα: στείλε στο Claude αυτή την αναφορά.' -f $cfgPc) $Bad
    Finish 18
}

# Puts the hub folder back as it was (used only when the deploy fails).
function Restore-Before {
    foreach ($rel in $plan) {
        $dst = Local-Path $HubDir $rel
        if ($hadBefore[$rel]) { Copy-Item -LiteralPath (Local-Path $keep $rel) -Destination $dst -Force }
        elseif (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
    }
    if ($tomlChanged) { [System.IO.File]::WriteAllBytes($cfgPc, $tomlBytes) }
}

if ($tomlChanged) {
    New-Item -ItemType Directory -Path $keep -Force | Out-Null
    [System.IO.File]::WriteAllBytes((Join-Path $keep 'wrangler.toml'), $tomlBytes)
    [System.IO.File]::WriteAllText($cfgPc, $tomlSafe, (New-Object System.Text.UTF8Encoding($false)))
    Say ('wrangler.toml του Hub: workers_dev = false και preview_urls = false (κλείνει η δοκιμαστική διεύθυνση *.workers.dev του live Hub, F04). Το παλιό: {0}' -f (Join-Path $keep 'wrangler.toml')) $Ok
    Say ('  Επαναφορά (μόνο με έγκριση): αυτό το αρχείο πίσω στο {0} και νέο deploy, ή Workers & Pages > {1} > Settings > Domains & Routes > workers.dev: https://dash.cloudflare.com/?to=/:account/workers-and-pages' -f $cfgPc, $HubWorker)
} else {
    Say 'wrangler.toml του Hub: workers_dev = false και preview_urls = false υπάρχουν ήδη: ΕΝΤΑΞΕΙ' $Ok
}

# 2. The new files into the hub folder
foreach ($rel in $plan) {
    $dst = Local-Path $HubDir $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
    Copy-Item -LiteralPath (Local-Path $gwhRepo $rel) -Destination $dst -Force
}
$bad = @($plan | Where-Object { (Get-FileSha (Local-Path $HubDir $_)) -ne $newSha[$_] })
if ($bad.Count -gt 0) {
    Restore-Before
    Say ('Τα νέα αρχεία δεν γράφτηκαν σωστά στον φάκελο του Hub ({0}): τα παλιά γύρισαν πίσω, ΔΕΝ ανέβηκε τίποτα.' -f ($bad -join ', ')) $Bad
    Finish 10
}
Say ('Νέα αρχεία στον φάκελο του Hub: {0}' -f ($plan -join ', ')) $Ok

# L119: the Mitgo code becomes the Worker secret MITGO_VERIFICATION right before the deploy (a new version of the code that
# runs now, which does not read it), so the new code shows the tag from its first answer; later deploys keep it.
if ($MitgoCode) {
    $ms = Set-WorkerSecret $gwh $HubWorker 'MITGO_VERIFICATION' $MitgoCode
    if ($ms.code -ne 0) {
        Restore-Before
        Say 'Ο κωδικός του Mitgo δεν μπήκε στον Worker του Hub: τα παλιά αρχεία γύρισαν στον φάκελο του Hub, ΔΕΝ ανέβηκε τίποτα. Έξοδος:' $Bad
        Say $ms.text
        Finish 22
    }
    Say ('Ο κωδικός επαλήθευσης του Mitgo μπήκε στον Worker "{0}" (μυστικό MITGO_VERIFICATION, δεν φαίνεται πουθενά).' -f $HubWorker) $Ok
}
# L150: the Impact code becomes the Worker secret IMPACT_VERIFICATION the same way, right before the deploy.
if ($ImpactCode) {
    $is = Set-WorkerSecret $gwh $HubWorker 'IMPACT_VERIFICATION' $ImpactCode
    if ($is.code -ne 0) {
        Restore-Before
        Say 'Ο κωδικός του Impact δεν μπήκε στον Worker του Hub: τα παλιά αρχεία γύρισαν στον φάκελο του Hub, ΔΕΝ ανέβηκε τίποτα. Έξοδος:' $Bad
        Say $is.text
        Finish 22
    }
    Say ('Ο κωδικός επαλήθευσης του Impact μπήκε στον Worker "{0}" (μυστικό IMPACT_VERIFICATION, δεν φαίνεται πουθενά).' -f $HubWorker) $Ok
}

# 3. Deploy the live Hub from its folder, with the wrangler version of this repo version
$d = Invoke-Deploy $gwh $cfgPc
if ($d.code -ne 0) {
    Restore-Before
    Say 'Το ανέβασμα απέτυχε: το live Hub έμεινε όπως ήταν, και τα παλιά αρχεία γύρισαν στον φάκελο του Hub. Έξοδος:' $Bad
    Say $d.text
    Finish 9
}
Say 'Το gearworldhub.com ανέβηκε με το νέο Hub.' $Ok
# F04 (lessons L106): the live Hub answers only on gearworldhub.com. wrangler lists every address it published to.
$liveWorkersDev = ($d.text -match '(?i)https://[a-z0-9-]*gear-world-hub\.[a-z0-9-]+\.workers\.dev')
if ($liveWorkersDev) { Say 'ΠΡΟΒΛΗΜΑ: το ανέβασμα λέει ότι το live Hub απαντά ακόμα και σε διεύθυνση *.workers.dev (F04). Δες στο τέλος τι να κάνεις.' $Bad }

# 4. Live checks (the edge may keep the old files for a few seconds)
if (-not $NoHttpCheck) {
    $pubPlan = @($plan | Where-Object { $_ -like 'public/*' -and $_ -ne 'public/robots.txt' })
    $state = @{}
    for ($try = 1; $try -le 4; $try++) {
        Start-Sleep -Seconds $(if ($try -eq 1) { 8 } else { 10 })
        $allNew = $true
        foreach ($rel in $pubPlan) {
            $state[$rel] = Get-LiveSha ($LiveUrl + (Get-UrlPath $rel) + '?gwcheck=' + $stamp + '-' + $try) ($rel -match '\.html$')
            if ($state[$rel] -ne $newSha[$rel]) { $allNew = $false }
        }
        if ($allNew) { break }
    }
    foreach ($rel in $pubPlan) {
        if ($state[$rel] -eq $newSha[$rel]) { Say ('  {0}: live = νέα έκδοση: ΕΝΤΑΞΕΙ' -f $rel) $Ok }
        else { Say ('  {0}: ΠΡΟΣΟΧΗ - το live δείχνει ακόμα άλλη έκδοση (cache;). Ξαναδές σε 1-2 λεπτά.' -f $rel) $Warn }
    }
    Test-Site $LiveUrl $true
    [void](Send-IndexNow)
} else { Say 'IndexNow: δεν στάλθηκε (χωρίς έλεγχο δικτύου).' }
Say ''
Say 'Για το live-baseline.txt (το ενημερώνει το Claude):'
foreach ($rel in $plan) { Say ('  {0} | {1} | {2} | file' -f $rel, (Get-Item -LiteralPath (Local-Path $HubDir $rel)).Length, $newSha[$rel]) }
Say ''
if ($liveWorkersDev) {
    Say 'ΠΡΟΣΟΧΗ: το νέο Hub είναι live στο https://gearworldhub.com, αλλά απαντά ακόμα και σε *.workers.dev, έξω από τους κανόνες ασφαλείας του domain.' $Bad
    Say '  Κλείσ'' το: Workers & Pages > gear-world-hub > Settings > Domains & Routes > workers.dev > Disable: https://dash.cloudflare.com/?to=/:account/workers-and-pages'
    Say '  Μετά στείλε στο Claude αυτή την αναφορά.'
    Finish 19
}
Say 'ΕΤΟΙΜΟ: το νέο Hub είναι live στο https://gearworldhub.com. Αν κάτι δεν σου αρέσει: οδηγίες επαναφοράς πιο πάνω.' $Ok
Finish 0
