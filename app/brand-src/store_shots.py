"""Store screenshots of the Gear World app (Google Play 1080x1920, App Store iPhone 1206x2622), English and Greek.

Renders the web build of the app (built with EXPO_PUBLIC_STORE_SHOTS=1, so the photo and voice buttons are drawn as on
a phone) at iPhone size, with live data read from gearworldhub.com and the Gear World sites. Every outside request is a
plain GET with the Gear World QA user agent; product /out/ and /go/ links are never requested (they count as clicks).
Then each screen is put on the navy background with its headline (white and gold, never red/green: lessons L35).

    npx expo export --platform web --output-dir <web>   (in app/mobile, with EXPO_PUBLIC_STORE_SHOTS=1)
    python store_shots.py <web> <app/brand/store>

Needs: Playwright for Python with Chromium, Pillow, curl.
"""
import functools
import http.server
import json
import os
import subprocess
import sys
import tempfile
import threading
import urllib.parse
from datetime import date

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

UA = 'GearWorldQA-bot/1.0 (+read-only check)'
FONT = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'  # Latin and Greek
VIEW = (402, 874)  # iPhone 16 Pro in points; x3 = 1206 x 2622
NAVY_TOP, NAVY_BOTTOM = (11, 31, 75), (3, 10, 31)
WHITE, GOLD = (245, 247, 251), (255, 194, 61)

HEADLINES = {
    'en-GB': [('1-home', 'One search,', 'every Gear World'), ('2-search', 'Compare prices', 'from many retailers'),
              ('3-product', 'Who sells it,', 'at a glance'), ('4-saved', 'Save products,', 'open them offline'),
              ('5-world', 'Browse each', 'Gear World'), ('6-settings', '11 languages,', 'no account needed')],
    'el-GR': [('1-home', 'Μία αναζήτηση,', 'όλα τα Gear Worlds'), ('2-search', 'Συγκρίνετε τιμές', 'από πολλά καταστήματα'),
              ('3-product', 'Ποιος το πουλά,', 'με μια ματιά'), ('4-saved', 'Αποθηκευμένα,', 'και χωρίς internet'),
              ('5-world', 'Κάθε Gear World', 'ξεχωριστά'), ('6-settings', '11 γλώσσες,', 'χωρίς λογαριασμό')],
}
SEARCH = {'en-GB': 'cordless drill', 'el-GR': 'cordless drill'}
SAVED_QUERIES = ['backpack', 'headphones', 'garden hose']


def curl(url, binary=True):
    """GET with the QA user agent. Returns (status, content type, body)."""
    if '/out/' in url or '/go/' in url:
        return 403, 'text/plain', b''
    with tempfile.NamedTemporaryFile(delete=False) as f:
        path = f.name
    try:
        r = subprocess.run(['curl', '-sS', '-L', '--max-time', '25', '-A', UA, '-o', path, '-w', '%{http_code} %{content_type}', url],
                           capture_output=True, text=True)
        code, _, ctype = (r.stdout.strip() + '  ').partition(' ')
        body = open(path, 'rb').read()
        return int(code or 0), ctype.strip() or 'application/octet-stream', body
    finally:
        os.unlink(path)


def saved_items():
    """Three real products from the Hub search, stored as the app stores its Saved list."""
    items = []
    today = date.today().isoformat()
    for q in SAVED_QUERIES:
        _, _, body = curl('https://gearworldhub.com/api/search?q=' + urllib.parse.quote(q))
        for r in (json.loads(body or b'{}').get('results') or []):
            if not r.get('image_url') or not r.get('price'):
                continue
            site = str(r.get('site', '')).upper()
            base = 'https://' + str(r.get('site_url', '')).replace('https://', '').strip('/')
            pid = str(r.get('id') or r.get('product_id'))
            items.append({
                'key': f'{site}:{pid}', 'id': pid, 'worldKey': site, 'worldName': r.get('site_name') or site, 'base': base,
                'name': r.get('product_name'), 'brand': r.get('brand') or '', 'retailer': r.get('retailer') or '',
                'category': r.get('category') or '', 'price': float(r['price']), 'wasPrice': None, 'currency': r.get('currency') or 'GBP',
                'inStock': r.get('stock_status') == 'in_stock', 'checkRetailer': r.get('stock_status') == 'check_retailer',
                'checked': None, 'image': r['image_url'], 'productUrl': r.get('product_url') or base, 'outUrl': f'{base}/out/{pid}',
                'savedAt': today, 'refreshedAt': '', 'notListed': False, 'imageFile': ''
            })
            break
    return items


def serve(root):
    handler = functools.partial(SpaHandler, directory=root)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


class SpaHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = '/index.html'
        return super().send_head()


def frame(shot, top, bottom, size):
    """The screen on the navy background, headline above it."""
    w, h = size
    canvas = Image.new('RGB', size, NAVY_BOTTOM)
    grad = ImageDraw.Draw(canvas)
    for y in range(h):
        k = y / h
        grad.line([(0, y), (w, y)], fill=tuple(int(NAVY_TOP[i] + (NAVY_BOTTOM[i] - NAVY_TOP[i]) * k) for i in range(3)))
    size_px = int(w * 0.082)
    font = ImageFont.truetype(FONT, size_px)
    for text in (top, bottom):
        while font.getlength(text) > w * 0.9 and size_px > 20:
            size_px -= 2
            font = ImageFont.truetype(FONT, size_px)
    line = int(size_px * 1.25)
    margin = int(h * 0.035)
    head = margin + 2 * line + int(h * 0.025)
    d = ImageDraw.Draw(canvas)
    for i, (text, color) in enumerate([(top, WHITE), (bottom, GOLD)]):
        d.text((w / 2, margin + line * (0.5 + i)), text, font=font, fill=color, anchor='mm')
    # the screen, scaled to fit under the headline, with rounded corners and a thin light border
    room_w, room_h = int(w * 0.84), int(h - head - h * 0.035)
    scale = min(room_w / shot.width, room_h / shot.height)
    sw, sh = int(shot.width * scale), int(shot.height * scale)
    screen = shot.resize((sw, sh), Image.LANCZOS)
    radius = int(sw * 0.07)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius, fill=255)
    x, y = (w - sw) // 2, head
    shadow = Image.new('L', (sw + 60, sh + 60), 0)
    ImageDraw.Draw(shadow).rounded_rectangle([30, 30, sw + 30, sh + 30], radius, fill=120)
    canvas.paste((0, 0, 0), (x - 30, y - 20), shadow.filter(ImageFilter.GaussianBlur(18)))
    canvas.paste(screen, (x, y), mask)
    ImageDraw.Draw(canvas).rounded_rectangle([x - 2, y - 2, x + sw + 1, y + sh + 1], radius + 2, outline=(70, 90, 130), width=3)
    return canvas


def main(web, out):
    items = saved_items()
    if len(items) < 2:
        sys.exit('Not enough products for the Saved screen')
    srv = serve(web)
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    raw = tempfile.mkdtemp(prefix='gw-shots-')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for lang, heads in HEADLINES.items():
            ctx = browser.new_context(viewport={'width': VIEW[0], 'height': VIEW[1]}, device_scale_factor=3, locale=lang)
            ctx.add_init_script('localStorage.setItem("gw-language", %s); localStorage.setItem("gw-saved-v1", %s);'
                                % (json.dumps(lang), json.dumps(json.dumps(items))))

            def route(r):
                url = r.request.url
                if url.startswith(base):
                    return r.continue_()
                if r.request.method != 'GET':
                    return r.abort()
                code, ctype, body = curl(url)
                r.fulfill(status=code or 502, body=body, headers={'Content-Type': ctype, 'Access-Control-Allow-Origin': '*'})
            ctx.route('**/*', route)
            page = ctx.new_page()
            shots = {}

            def snap(name, url, after=None):
                page.goto(base + url, wait_until='networkidle', timeout=90000)
                page.wait_for_timeout(2500)
                if after:
                    after()
                    page.wait_for_load_state('networkidle')
                    page.wait_for_timeout(2500)
                path = os.path.join(raw, f'{lang}-{name}.png')
                page.screenshot(path=path)
                shots[name] = Image.open(path).convert('RGB')

            snap('1-home', '/')
            snap('2-search', '/search?q=' + urllib.parse.quote(SEARCH[lang]))
            # the product screen, opened from the search results like a person would
            snap('3-product', '/search?q=' + urllib.parse.quote(SEARCH[lang]),
                 lambda: page.locator('[role="button"]').filter(has=page.locator('img')).first.click())
            snap('4-saved', '/saved')
            snap('5-world', '/world/TGW')
            snap('6-settings', '/settings')
            ctx.close()
            short = 'en' if lang.startswith('en') else 'el'
            for name, top, bottom in heads:
                shot = shots[name]
                frame(shot, top, bottom, (1206, 2622)).save(os.path.join(out, 'ios-screenshots', f'gear-world-ios-{short}-{name}.jpg'), quality=92)
                frame(shot, top, bottom, (1080, 1920)).save(os.path.join(out, 'screenshots', f'gear-world-{short}-{name}.jpg'), quality=92)
        browser.close()
    srv.shutdown()
    print('ok', out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
