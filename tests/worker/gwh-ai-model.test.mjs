// Workers AI models retired by Cloudflare on 20 Nov 2026 (lessons L173): after that date a request to one of them
// answers 404 model_not_found. The Hub search translated foreign words with @cf/meta/llama-3.1-8b-instruct-fp8; it now
// uses the model of the photo search (Gemma 4), without thinking, and reads its answer in any shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TEXT_MODEL, PHOTO_MODEL, translationInput, answerText } from '../../sites/gwh/photo-search.js';

// From Cloudflare's email "Model Decommissioning in 3 Days (November 20, 2026)".
export const RETIRED_MODELS = [
  '@cf/bytedance/stable-diffusion-xl-lightning', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/deepseek-ai/deepseek-v4-flash-0731', '@cf/deepseek-ai/deepseek-v4-pro-0813', '@cf/google/embeddinggemma-300m',
  '@cf/google/gemma-2b-it-lora', '@cf/google/gemma-7b-it-lora', '@cf/llava-hf/llava-1.5-7b-hf', '@cf/lykon/dreamshaper-8-lcm',
  '@cf/meta-llama/llama-2-7b-chat-hf-lora', '@cf/meta/llama-3.1-8b-instruct-fp8', '@cf/meta/llama-3.2-1b-instruct',
  '@cf/meta/llama-3.2-3b-instruct', '@cf/moonshotai/kimi-k2.6', '@cf/moonshotai/kimi-k2.7-code', '@cf/myshell-ai/melotts',
  '@cf/nvidia/nemotron-3-120b-a12b', '@cf/openai/whisper-tiny-en', '@cf/qwen/qwen3-30b-a3b-fp8', '@cf/qwen/qwq-32b',
  '@cf/runwayml/stable-diffusion-v1-5-inpainting', '@cf/stabilityai/stable-diffusion-xl-base-1.0', '@cf/zai-org/glm-5.2',
  '@cf/zai-org/glm-5.3-flash'
];

function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (/\.(m?js)$/.test(name)) out.push(p);
  }
  return out;
}

test('L173: no Worker code (the Hub, its pages, the sites engine) asks a model Cloudflare retires on 20 Nov 2026', () => {
  const found = [];
  for (const root of ['sites', 'src']) {
    for (const f of jsFiles(root)) {
      const text = readFileSync(f, 'utf8');
      for (const m of RETIRED_MODELS) if (text.includes(`'${m}'`) || text.includes(`"${m}"`) || text.includes(`\`${m}\``)) found.push(`${f}: ${m}`);
    }
  }
  // The sites engine (src/lib/hub.js) is fixed on the sites line for the next ALL UPDATES; the Hub must be clean.
  assert.deepEqual(found.filter(x => x.startsWith('sites')), []);
});

test('L173: the Hub search translates with the photo search model, without thinking, and the Hub asks no other model', () => {
  assert.equal(TEXT_MODEL, PHOTO_MODEL);
  assert.equal(TEXT_MODEL, '@cf/google/gemma-4-26b-a4b-it');
  const input = translationInput('System words', 'δράπανο');
  assert.deepEqual(input, {
    messages: [{ role: 'system', content: 'System words' }, { role: 'user', content: 'δράπανο' }],
    max_tokens: 48, temperature: 0, chat_template_kwargs: { enable_thinking: false }
  });
  const worker = readFileSync('sites/gwh/worker.js', 'utf8');
  const runs = worker.match(/env\.AI\.run\(([^,]+),/g) || [];
  // The two translations of the search, and the reading of a search typed as a sentence (Idea 9, L180): the same model.
  assert.equal(runs.length, 3, 'the two translations of the search and the reading of a sentence');
  assert.ok(runs.every(r => r === 'env.AI.run(TEXT_MODEL,'), runs.join(' | '));
});

test('L173: the answer is read in every shape the model gives, without a thinking part; more than one line is not used', () => {
  assert.equal(answerText({ response: ' drill\n' }), 'drill');
  assert.equal(answerText({ choices: [{ message: { content: '<think>the user wants…</think>\ncordless drill\n' } }] }), 'cordless drill');
  assert.equal(answerText({ choices: [{ message: { content: 'Here is the English query\ncordless drill' } }] }), '', 'an explanation and the words: not used, as before');
  assert.equal(answerText({ choices: [{ message: { content: [{ type: 'text', text: 'hand ' }, { type: 'text', text: 'saw' }] } }] }), 'hand saw');
  assert.equal(answerText('kettle'), 'kettle');
  assert.equal(answerText(null), '');
  assert.equal(answerText({ response: { not: 'text' } }), '');
});
