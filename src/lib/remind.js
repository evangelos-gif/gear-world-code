// "Remind me on 27 Nov" (lessons L182, owner's decisions of 15 and 17 Nov 2026): on a product page a visitor leaves an
// email address, ticks an unticked box, passes Cloudflare Turnstile, and on 27 Nov 2026 gets one email with a link to
// that product (up to the three most recent they chose). Gear World Hub keeps the list (its D1 first, then MailerLite,
// group "Gear World Remind me 27 Nov", never the weekly list) and deletes it on 28 Nov. No confirmation email (owner,
// 17 Nov 2026: there is no system that sends one, and one would not have been live before 20 Nov).
// - The box shows only until the end of 27 Nov in London (GMT in November), only on the page of a product the visitor
//   may see (its retailer delivers to the visitor's country, lessons L107), and only while the Hub answers that its
//   list is open (GET https://hub.internal/internal/remind), so the sites can go live before the Hub without a dead box.
// - No "deals", no percentage, no "Was" anywhere in its texts (lessons L103, L107).

export const REMIND_UNTIL_ISO = '2026-11-27T23:59:59Z';
export const REMIND_UNTIL = Date.parse(REMIND_UNTIL_ISO);
export const REMIND_URL = 'https://hub.internal/internal/remind';
export const REMIND_PATH = '/api/remind';

// The Hub's answer is kept for a while in this Worker (10 minutes when open, 1 minute when not), so a product page asks
// the Hub at most that often. One cache per site Worker (createWorker).
export function remindProbe({ okMs = 600000, noMs = 60000 } = {}) {
  let last = { at: -Infinity, open: false };
  return async function remindOpen(binding, now) {
    if (!binding || !(now <= REMIND_UNTIL)) return false;
    if (now - last.at < (last.open ? okMs : noMs)) return last.open;
    let open = false;
    try {
      const res = await binding.fetch(REMIND_URL, { method: 'GET' });
      const data = res.ok ? await res.json().catch(() => null) : null;
      open = Boolean(data && data.ok === true && data.open === true);
    } catch {
      open = false;
    }
    last = { at: now, open };
    return open;
  };
}
