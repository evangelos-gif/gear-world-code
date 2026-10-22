# Πηγή του λογότυπου Gear World (για να ξαναβγεί το πακέτο)

Το `app/brand/` παράγεται από εδώ. Δεν χρειάζεται για την καθημερινή δουλειά.

- `make_v2.py` φτιάχνει τα SVG (σήμα, εικονίδιο, Android, λογότυπα, splash, feature graphic).
- `globe.py` σχεδιάζει την υδρόγειο (Natural Earth 1:110m, public domain) με την Ευρώπη πάνω δεξιά.
- `export.py` βγάζει όλα τα PNG για iOS, Android, Expo και τα stores. Χρειάζεται Node.js με `@resvg/resvg-js` (`render.js`).
- `preview3.py` φτιάχνει τις εικόνες ελέγχου σε 48, 96 και 512 px.
- Γραμματοσειρά: Poppins ExtraBold (SIL Open Font License, `fonts/OFL-Poppins.txt`). Το κείμενο γίνεται καμπύλες, οπότε τα SVG δεν χρειάζονται τη γραμματοσειρά.

```
pip install shapely fonttools pillow
npm install @resvg/resvg-js@2
python make_v2.py svg2
python export.py brand
```
