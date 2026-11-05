# Reads every QR code ON the rendered poster with two programs (OpenCV and ZXing, the reader of many phone apps), as a
# phone camera would: each code alone at several sizes (pixels per QR square, like a photo from near or far), and the
# whole poster at phone-photo sizes. Every code must give exactly its address. READ-ONLY.
# Usage (after build.py): python3 check.py cgw      (or hub)
import sys, os, json
import cv2
import zxingcpp

name = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), name, 'out')
img = cv2.imread(os.path.join(out, 'check.png'))
boxes = json.load(open(os.path.join(out, 'qr-boxes.json')))
sc = img.shape[1] / 420  # pixels per mm
det = cv2.QRCodeDetector()
PX_PER_MODULE = (3, 4, 6, 10, 16)  # 3 = a far, small photo of the code; 16 = very close


def zx(image):
    return [r.text for r in zxingcpp.read_barcodes(image) if r.format == zxingcpp.BarcodeFormat.QRCode]


bad = 0
for key, v in boxes.items():
    x, y, w, h = v['box']
    crop = img[int(y * sc):int((y + h) * sc), int(x * sc):int((x + w) * sc)]
    module_px = v['module_mm'] * sc
    zres, cres = [], []
    for p in PX_PER_MODULE:
        f = p / module_px
        small = cv2.resize(crop, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
        zres.append(zx(small) == [v['url']])
        cres.append(det.detectAndDecode(small)[0] == v['url'])
    # ZXing must read it at every size; OpenCV (weaker, it misses some in-between sizes) at most of them.
    ok = all(zres) and sum(cres) >= len(cres) - 1
    bad += 0 if ok else 1
    print(f"{key}: {'OK' if ok else 'FAIL'} - ZXing {sum(zres)}/{len(zres)} sizes, OpenCV {sum(cres)}/{len(cres)}; "
          f"{v['modules']} squares of {v['module_mm']} mm, {v['modules'] * v['module_mm']:.0f} mm wide -> {v['url']}")
want = sorted(v['url'] for v in boxes.values())
for width in (1600, 2400, 3200, 4000):
    small = cv2.resize(img, (width, int(width * img.shape[0] / img.shape[1])), interpolation=cv2.INTER_AREA)
    got = sorted(zx(small))
    match = got == want
    print(f'whole poster as a {width}px photo: {len(got)} codes read, ' + ('all correct' if match else f'got {got}'))
    if width >= 2400 and not match:
        bad += 1
print('RESULT:', 'OK' if bad == 0 else 'FAIL')
sys.exit(1 if bad else 0)
