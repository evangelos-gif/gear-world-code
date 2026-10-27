// gear-world-posters: the private Worker that counts poster QR scans (lessons L76).
// It has no public address (no routes, workers.dev off): only the Gear World Workers reach it, through their service
// binding POSTERS (src/lib/poster-scan.js). One request = +1 for (day, poster, site) in the D1 table poster_scans.
// Nothing about the visitor arrives here or is kept: only the site code and the poster name.

// The sites that count (the Hub and the 10 Gear Worlds), as the Workers send them.
export const SITES = ['hub', 'cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw', 'vgw', 'agw', 'sgw'];

// The printed posters (utm_campaign). Anything else that comes with utm_source=poster is counted as "other", so a
// made-up address cannot add rows; a new poster is one more name here and an update of this Worker only.
// poster-test: the test after a change (it is deleted afterwards with tools/poster-setup.ps1 -Step test-cleanup).
export const CAMPAIGNS = ['poster10', 'poster-a', 'poster-b', 'poster-c', 'poster-test'];
export const OTHER = 'other';

// At most this many counts per day, poster and site. A real poster gets far fewer; a bot that keeps opening the
// address cannot use up the daily D1 write allowance of the account (lessons L49): 11 sites x 6 names x 200 at most.
export const DAILY_CAP = 200;

export const COUNT_SQL = 'INSERT INTO poster_scans (day, campaign, site, scans) VALUES (?, ?, ?, 1) '
  + 'ON CONFLICT (day, campaign, site) DO UPDATE SET scans = scans + 1 WHERE scans < ?';

const MAX_BODY = 512;

export function campaignName(raw) {
  const c = String(raw || '').trim().toLowerCase();
  return CAMPAIGNS.includes(c) ? c : OTHER;
}

// The day in London (the owner's time), as YYYY-MM-DD. UTC if the time zone cannot be read.
export function londonDay(now = new Date()) {
  try {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  } catch { /* falls back to UTC */ }
  return now.toISOString().slice(0, 10);
}

export async function countScan(db, input, now = new Date(), cap = DAILY_CAP) {
  const site = String((input && input.site) || '').trim().toLowerCase();
  if (!SITES.includes(site)) return { ok: false, error: 'site' };
  const campaign = campaignName(input && input.campaign);
  const day = londonDay(now);
  const r = await db.prepare(COUNT_SQL).bind(day, campaign, site, cap).run();
  const changes = r && r.meta && typeof r.meta.changes === 'number' ? r.meta.changes : 1;
  return { ok: true, day, campaign, site, counted: changes > 0 };
}

function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export function createPosterCounter() {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname !== '/scan') return reply(404, { ok: false, error: 'not_found' });
      if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
      if (!env || !env.POSTER_DB) return reply(503, { ok: false, error: 'no_database' });
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return reply(413, { ok: false, error: 'too_large' });
      const text = await request.text();
      if (text.length > MAX_BODY) return reply(413, { ok: false, error: 'too_large' });
      let input;
      try { input = JSON.parse(text); } catch { return reply(400, { ok: false, error: 'json' }); }
      try {
        const result = await countScan(env.POSTER_DB, input);
        return reply(result.ok ? 200 : 400, result);
      } catch (error) {
        console.error('poster count failed:', error && error.message);
        return reply(500, { ok: false, error: 'count_failed' });
      }
    }
  };
}
