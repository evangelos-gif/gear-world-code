-- Poster QR scans (lessons L76): one row per day, poster and site, with the number of scans.
-- Nothing about the visitors: no IP address, no cookie, no browser.
CREATE TABLE IF NOT EXISTS poster_scans (
  day TEXT NOT NULL,                -- YYYY-MM-DD, London time
  campaign TEXT NOT NULL,           -- poster10, poster-a, poster-b, poster-c, poster-test or other (utm_campaign)
  site TEXT NOT NULL,               -- hub, cgw, mgw, wgw, kgw, hgw, ggw, tgw, vgw, agw, sgw
  scans INTEGER NOT NULL DEFAULT 0, -- at most 200 a day per poster and site (src/posters.js, DAILY_CAP)
  PRIMARY KEY (day, campaign, site)
) WITHOUT ROWID;
