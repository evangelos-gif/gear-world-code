// Writes a small, synthetic copy of the Gear World Hub public files (same structure as the live hub) for tests.
//   node tests/fixtures/make-hub-fixture.mjs <hub folder>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES = ['en-GB', 'el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU'];
const AND = ['and', 'και', 'und', 'et', 'e', 'y', 'e', 'en', 'dhe', 'și', 'и'];
const SIX = ['six', 'έξι', 'sechs', 'six', 'sei', 'seis', 'seis', 'zes', 'gjashtë', 'șase', 'шести'];

function card(code, name) {
  return [
    '            <a',
    '  class="gwh-quick-world gwh-quick-world-live gwh-image-world"',
    `  href="https://${name.toLowerCase()}gearworld.com/"`,
    `  data-world="${code}"`,
    `  style="--world-image:url('/hub-${code.toLowerCase()}.jpg')"`,
    `  aria-label="${name}">`,
    '  <span class="gwh-image-world-overlay">',
    `    <span class="gwh-image-world-code">${code}</span>`,
    `    <strong class="gwh-image-world-title">${name}</strong>`,
    '  </span>',
    '</a>'
  ].join('\r\n');
}

export function hubIndexHtml() {
  return [
    '<!doctype html>', '<html lang="en">', '<head>', '  <link rel="stylesheet" href="/styles.css">', '</head>', '<body>',
    '<div class="gwh-quick-worlds">',
    card('HGW', 'Home'), card('GGW', 'Garden'),
    '</div>',
    "<p>Access Construction, Men's, Women's, Kids', Home and Garden Gear World from one starting point.</p>",
    '<p>Garden Gear World is now live, expanding the Gear World network to six specialist shopping worlds.</p>',
    '<script src="/translations.js"></script>', '</body>', '</html>', ''
  ].join('\n');
}

export function hubTranslationsJs() {
  const oneHub = LOCALES.map((l, i) => `${l} Construction, Men's, Women's, Kids', Home ${AND[i]} Garden Gear World.`);
  const growing = LOCALES.map((l, i) => `Garden Gear World ${l} ${SIX[i]} worlds.`);
  const v2 = LOCALES.map(l => [
    `    "${l}": {`,
    '      titles: [',
    ['A', 'B', 'C', 'D', 'E', 'F'].map(x => `        "${x} ${l}"`).join(',\n'),
    '      ],',
    '',
    '      descriptions: [',
    ['a', 'b', 'c', 'd', 'e', 'f'].map(x => `        "${x} ${l}."`).join(',\n'),
    '      ]',
    '    }'
  ].join('\n')).join(',\n\n');
  return [
    '(() => {', '  const LOCALES = [', LOCALES.map(l => `    "${l}"`).join(',\n'), '  ];', '  const T = {',
    `    oneHubDesc: ${JSON.stringify(oneHub)},`,
    `    growingDesc: ${JSON.stringify(growing)},`,
    '  };', '})();', '', '(() => {', '  const V2 = {', v2, '  };', '})();', ''
  ].join('\n');
}

export function writeHubFixture(dir) {
  mkdirSync(join(dir, 'public'), { recursive: true });
  writeFileSync(join(dir, 'public', 'index.html'), hubIndexHtml());
  writeFileSync(join(dir, 'public', 'translations.js'), hubTranslationsJs());
  writeFileSync(join(dir, 'worker.js'), 'export default { fetch() { return new Response("hub"); } };\n');
  writeFileSync(join(dir, 'wrangler.toml'), 'name = "gear-world-hub"\nmain = "worker.js"\n\n[[d1_databases]]\nbinding = "gear_world_registry"\ndatabase_name = "gear-world-registry"\n');
}

if (process.argv[1] && process.argv[1].endsWith('make-hub-fixture.mjs')) {
  if (!process.argv[2]) { console.error('usage: node make-hub-fixture.mjs <folder>'); process.exit(2); }
  writeHubFixture(process.argv[2]);
}
