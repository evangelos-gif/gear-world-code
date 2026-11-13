// The tools run wrangler through a temporary .cmd file and refuse any command with & | < > ^ % (cmd.exe would read
// them). On 13 Nov 2026 a LIKE 'ux_products_refresh_stable_key%' in legacy-import.ps1 (L119) was refused: the CGW dry
// run stopped with exit 1 and no report (lessons L120). Every SQL text given to Select-Rows or Invoke-Wrangler must be
// free of those characters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools');

function refusedCharacters(text) {
  const bad = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*function\s/.test(line) || !/\b(Select-Rows|Invoke-Wrangler)\s/.test(line)) return;
    for (const m of line.matchAll(/"((?:`.|[^"`])*)"/g)) {
      if (/[&|<>^%]/.test(m[1].replace(/`"/g, ''))) bad.push(`${i + 1}: ${m[1].slice(0, 100)}`);
    }
  });
  return bad;
}

test('no wrangler command in the tools has a character the .cmd guard refuses', () => {
  const found = [];
  for (const f of readdirSync(tools).filter(n => n.endsWith('.ps1'))) {
    const text = readFileSync(join(tools, f), 'utf8');
    if (!text.includes("-match '[&|<>^%]'")) continue;
    for (const b of refusedCharacters(text)) found.push(`${f}:${b}`);
  }
  assert.deepEqual(found, []);
});

test('the check finds a LIKE with % (the 13 Nov 2026 mistake)', () => {
  const line = `    $layout = Select-Rows "SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'ux_products_refresh_stable_key%'"`;
  assert.equal(refusedCharacters(line).length, 1);
  assert.equal(refusedCharacters(`    $x = Select-Rows "SELECT COUNT(*) AS n FROM products WHERE instr(name, 'ux_') = 1"`).length, 0);
});

test('legacy-import.ps1 finds the CGW key without LIKE and writes a report on any unexpected error', () => {
  const text = readFileSync(join(tools, 'legacy-import.ps1'), 'utf8');
  assert.match(text, /instr\(name, 'ux_products_refresh_stable_key'\) = 1/);
  assert.match(text, /\ntrap \{\r?\n[\s\S]{0,400}Finish 9/);
});
