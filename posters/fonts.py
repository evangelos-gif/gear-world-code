# Installs the poster fonts for this user (Linux): Barlow Condensed (SIL Open Font License) from the npm package
# @fontsource/barlow-condensed (posters/package.json), turned from .woff into .ttf so Cairo can use it.
# Inter and Inter Display must be installed already. Usage (after npm ci in posters/): python3 fonts.py
import os, glob, subprocess
from fontTools.ttLib import TTFont

here = os.path.dirname(os.path.abspath(__file__))
dest = os.path.expanduser('~/.fonts')
os.makedirs(dest, exist_ok=True)
for w in (600, 700, 800, 900):
    src = os.path.join(here, 'node_modules', '@fontsource', 'barlow-condensed', 'files', f'barlow-condensed-latin-{w}-normal.woff')
    f = TTFont(src); f.flavor = None
    f.save(os.path.join(dest, f'BarlowCondensed-{w}.ttf'))
subprocess.run(['fc-cache', '-f'], check=False)
print('fonts:', sorted(os.path.basename(p) for p in glob.glob(os.path.join(dest, 'BarlowCondensed-*.ttf'))))
