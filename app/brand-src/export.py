"""Exports the Gear World brand pack: SVG masters + every PNG size Android, iOS, Expo and the stores need."""
import os, shutil, subprocess, sys
from PIL import Image
SRC = 'svg2'; OUT = sys.argv[1]
import tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
TMP = os.path.join(tempfile.gettempdir(), 'gw-brand-render')
os.makedirs(TMP, exist_ok=True)
def render(name, w):
    out = os.path.join(TMP, f'{name}-{w}.png')
    subprocess.run(['node', os.path.join(HERE, 'render.js'), os.path.join(SRC, name + '.svg'), out, str(w)], check=True)
    return Image.open(out).convert('RGBA')
def save(im, rel, rgb=False):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    (im.convert('RGB') if rgb else im).save(p, optimize=True)
if os.path.exists(OUT): shutil.rmtree(OUT)
shutil.copytree(SRC, os.path.join(OUT, 'svg'))

icon = render('icon-1024', 1024)
fg = render('android-adaptive-foreground', 1024)
bg = render('android-adaptive-background', 1024)
mono = render('android-monochrome', 1024)
full = Image.alpha_composite(bg, fg)

# iOS: every App Icon size, square, no transparency (Apple rejects alpha)
for s in (20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024):
    save(icon.resize((s, s), Image.LANCZOS), f'ios/AppIcon-{s}.png', rgb=True)
# Android: Play Store icon, adaptive layers (108dp = 432 px at xxxhdpi), legacy launcher icons
save(icon.resize((512, 512), Image.LANCZOS), 'android/play-store-icon-512.png', rgb=True)
save(fg.resize((432, 432), Image.LANCZOS), 'android/adaptive-foreground-432.png')
save(bg.resize((432, 432), Image.LANCZOS), 'android/adaptive-background-432.png', rgb=True)
save(mono.resize((432, 432), Image.LANCZOS), 'android/adaptive-monochrome-432.png')
o = 1024 // 6; legacy = full.crop((o, o, 1024 - o, 1024 - o))
for d, s in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
    save(legacy.resize((s, s), Image.LANCZOS), f'android/mipmap-{d}/ic_launcher.png')
    save(legacy.resize((s, s), Image.LANCZOS), f'android/mipmap-{d}/ic_launcher_round.png')
save(render('play-feature-graphic', 1024), 'android/play-feature-graphic-1024x500.png', rgb=True)
# Expo (app.json): icon, adaptive icon layers, splash image
save(icon, 'expo/icon.png', rgb=True)
save(fg, 'expo/adaptive-icon.png')
save(bg, 'expo/adaptive-icon-background.png', rgb=True)
save(mono, 'expo/adaptive-icon-monochrome.png')
save(render('logo-badge-full', 1024), 'expo/splash-icon.png')
# splash screen (largest phone), store/marketing logos
save(render('splash', 1284), 'splash/splash-1284x2778.png', rgb=True)
save(render('logo-badge-full', 2048), 'logo/gear-world-badge-full-2048.png')
save(render('logo-badge-name', 1024), 'logo/gear-world-badge-name-1024.png')
save(render('logo-horizontal-dark', 2400), 'logo/gear-world-horizontal-dark.png', rgb=True)
save(render('logo-horizontal-light', 2400), 'logo/gear-world-horizontal-light.png', rgb=True)
save(render('gw-monogram-gold', 1024), 'logo/gw-monogram-gold-1024.png')
for f in ('preview-small-sizes.png', 'preview-large.png'):
    shutil.copy(os.path.join('png2', f), os.path.join(OUT, 'preview', f)) if os.path.isdir(os.path.join(OUT, 'preview')) else (os.makedirs(os.path.join(OUT, 'preview')), shutil.copy(os.path.join('png2', f), os.path.join(OUT, 'preview', f)))
print('done')
