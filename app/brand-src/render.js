// usage: node render.js in.svg out.png width
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const [,, inp, out, w] = process.argv;
const r = new Resvg(fs.readFileSync(inp), { fitTo: { mode: 'width', value: Number(w) } });
fs.writeFileSync(out, r.render().asPng());
