#!/usr/bin/env python3
"""Gear World weekly deals email (MailerLite campaign HTML).

Used by the scheduled task "Gear World weekly deals email" (every Thursday, the owner presses Schedule/Send himself).
Input: a JSON file with the week's items, written by the task after it checked every price and stock on our sites.
Output: one HTML file for MailerLite (create_campaign content). No network, no secrets.

  python3 -I email/weekly_deals.py --in week.json --out email.html --address "<postal address from the welcome email>"

week.json:
{
  "slug": "deals-2026-11-05",                 # utm_campaign
  "checked": "5 Nov 2026",                    # the day prices were checked
  "preheader": "...", "headline": "...", "intro": "...",
  "items": [ {"section": "drop" | "pick", "site": "Car Gear World", "name": "...", "note": "...",
              "url": "https://<site>/product/...", "image": "https://...", "price": 11.99, "was_price": 52.13 | null,
              "retailer": "Tooled Up"} ],
  "codes": [ {"title": "£4 off orders of £20+", "code": "HALLOWEEN", "retailer": "Joybuy", "ends": "31 Dec 2026"} ]
}
Rules kept here: Gear World is the hero (the retailer only in the small print), real prices with "Price checked <date>,
may change", #ad and the commission line, postal address and unsubscribe link, no /out/ or /go/ links, navy/gold
colours (never red/green for information).
"""
import argparse
import html
import json
import sys

NAVY, GOLD, INK, MUTED, BG, BLUE = '#0B1730', '#F5B301', '#1B2333', '#5B6577', '#F2F4F8', '#1D4ED8'


def esc(v):
    return html.escape(str(v), quote=True)


def money(v):
    return '£{:,.2f}'.format(float(v))


def with_utm(url, slug):
    if '/out/' in url or '/go/' in url:
        raise SystemExit('never /out/ or /go/ links in the email: ' + url)
    return url + ('&' if '?' in url else '?') + 'utm_source=mailerlite&utm_medium=email&utm_campaign=' + slug


def card(it, slug, checked):
    url = esc(with_utm(it['url'], slug))
    was = save = ''
    if it.get('was_price') and float(it['was_price']) > float(it['price']):
        pct = round(100 * (float(it['was_price']) - float(it['price'])) / float(it['was_price']))
        was = ' <span style="color:{};text-decoration:line-through;font-size:14px;">{}</span>'.format(MUTED, money(it['was_price']))
        save = ('<span style="display:inline-block;background:{};color:#FFFFFF;font-size:12px;font-weight:bold;'
                'padding:3px 8px;border-radius:4px;margin-left:6px;">Save {}%</span>').format(NAVY, pct)
    return '''<tr><td style="padding:0 24px 20px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E3E7EE;border-radius:8px;">
<tr><td width="132" valign="top" style="padding:14px;"><a href="{url}"><img src="{img}" width="104" alt="{name}" style="display:block;width:104px;height:auto;border:0;border-radius:6px;"></a></td>
<td valign="top" style="padding:14px 16px 14px 0;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 4px 0;font-size:12px;color:{blue};font-weight:bold;letter-spacing:.02em;">{site}</p>
<p style="margin:0 0 6px 0;font-size:16px;line-height:1.35;color:{ink};font-weight:bold;"><a href="{url}" style="color:{ink};text-decoration:none;">{name}</a></p>
<p style="margin:0 0 6px 0;font-size:14px;line-height:1.45;color:{muted};">{note}</p>
<p style="margin:0 0 8px 0;font-size:20px;color:{ink};font-weight:bold;">{price}{was}{save}</p>
<p style="margin:0 0 10px 0;font-size:12px;color:{muted};">Price checked {checked}, may change · retailer: {retailer}</p>
<a href="{url}" style="display:inline-block;background:{gold};color:{navy};font-size:14px;font-weight:bold;text-decoration:none;padding:10px 16px;border-radius:6px;">See the deal</a>
</td></tr></table></td></tr>'''.format(url=url, img=esc(it['image']), name=esc(it['name']), site=esc(it['site']).upper(),
                                      note=esc(it.get('note', '')), price=money(it['price']), was=was, save=save,
                                      checked=esc(checked), retailer=esc(it['retailer']), blue=BLUE, ink=INK,
                                      muted=MUTED, gold=GOLD, navy=NAVY)


def heading(text):
    return ('<tr><td style="padding:8px 24px 14px 24px;font-family:Arial,Helvetica,sans-serif;">'
            '<h2 style="margin:0;font-size:20px;color:{};">{}</h2></td></tr>').format(NAVY, esc(text))


def build(week, address):
    slug, checked = week['slug'], week['checked']
    drops = [i for i in week['items'] if i.get('section') == 'drop']
    picks = [i for i in week['items'] if i.get('section') != 'drop']
    rows = []
    if drops:
        rows.append(heading('Price drops'))
        rows += [card(i, slug, checked) for i in drops]
    if picks:
        rows.append(heading('Picks for the week'))
        rows += [card(i, slug, checked) for i in picks]
    codes = ''
    if week.get('codes'):
        lines = ''.join('<p style="margin:0 0 8px 0;font-size:14px;line-height:1.5;color:{ink};"><strong>{t}</strong> with code '
                        '<strong>{c}</strong> · retailer: {r} · ends {e}, their terms apply</p>'.format(
                            ink=INK, t=esc(c['title']), c=esc(c['code']), r=esc(c['retailer']), e=esc(c['ends']))
                        for c in week['codes'])
        codes = ('<tr><td style="padding:4px 24px 20px 24px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" '
                 'style="background:#FFFFFF;border:1px solid #E3E7EE;border-radius:8px;"><tr><td style="padding:18px;'
                 'font-family:Arial,Helvetica,sans-serif;"><h2 style="margin:0 0 10px 0;font-size:18px;color:{};">'
                 'Codes that work right now</h2>{}</td></tr></table></td></tr>').format(NAVY, lines)
    hub = esc(with_utm('https://gearworldhub.com/', slug))
    return '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>This week on Gear World</title></head>
<body style="margin:0;padding:0;background:{bg};">
<div style="display:none;max-height:0;overflow:hidden;">{pre}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{bg};"><tr><td align="center" style="padding:16px 8px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td align="right" style="padding:0 4px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;"><a href="{{$url}}" style="color:{muted};">View in browser</a></td></tr>
<tr><td style="background:{navy};border-radius:8px 8px 0 0;padding:28px 24px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 6px 0;color:{gold};font-size:13px;font-weight:bold;letter-spacing:.12em;">GEAR WORLD · WEEKLY DEALS</p>
<h1 style="margin:0 0 8px 0;color:#FFFFFF;font-size:26px;line-height:1.25;">{head}</h1>
<p style="margin:0;color:#D6DCE8;font-size:15px;line-height:1.5;">{intro}</p></td></tr>
<tr><td style="background:{bg};padding-top:20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
{rows}
{codes}
<tr><td align="center" style="padding:0 24px 24px 24px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 12px 0;font-size:15px;color:{ink};">Looking for something else? Search every Gear World at once, or snap a photo.</p>
<a href="{hub}" style="display:inline-block;background:{navy};color:#FFFFFF;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:6px;">Open Gear World Hub</a></td></tr>
</table></td></tr>
<tr><td style="background:{navy};border-radius:0 0 8px 8px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#D6DCE8;font-size:13px;line-height:1.55;">
<p style="margin:0 0 10px 0;">#ad · Gear World is free to use. When you buy through our links, we may earn a commission from the retailer, at no extra cost to you. Prices and stock can change; always check the final price on the retailer's website.</p>
<p style="margin:0 0 10px 0;"><strong style="color:#FFFFFF;">Gear World</strong> · {addr}</p>
<p style="margin:0;">You're receiving this email because you signed up for Gear World updates at gearworldhub.com or one of the Gear World sites. <a href="{{$unsubscribe}}" style="color:{gold};">Unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>'''.format(
        bg=BG, pre=esc(week.get('preheader', '')), muted=MUTED, navy=NAVY, gold=GOLD, ink=INK, head=esc(week['headline']),
        intro=esc(week.get('intro', '')), rows='\n'.join(rows), codes=codes, hub=hub, addr=esc(address))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--address', required=True)
    a = ap.parse_args()
    week = json.load(open(a.src, encoding='utf-8'))
    if not week.get('items'):
        sys.exit('no items')
    if not a.address.strip():
        sys.exit('the postal address is required (UK/EU email rules)')
    out = build(week, a.address.strip())
    for tag in ('{$unsubscribe}', '#ad', 'Price checked'):
        if tag not in out:
            sys.exit('missing ' + tag)
    open(a.out, 'w', encoding='utf-8').write(out)
    print('ok', len(out))


if __name__ == '__main__':
    main()
