#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

import { flattenDotPath, hashValue, diffCanonical } from './lib/diff.mjs';
import { buildArbKeyMap } from './lib/flatten.mjs';
import { buildArbJson } from './lib/transpile.mjs';
import { translateIncremental } from './lib/translate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const CANONICAL = {
  'zh-TW': join(REPO_ROOT, 'i18n/canonical/zh-TW.json'),
  en: join(REPO_ROOT, 'i18n/canonical/en.json'),
  ja: join(REPO_ROOT, 'i18n/canonical/ja.json'),
};
const CACHE_PATH = join(REPO_ROOT, 'i18n/.i18n-cache.json');
const WEB_MESSAGES_DIR = join(REPO_ROOT, 'src/messages');
const MOBILE_L10N_DIR = join(REPO_ROOT, 'mobile/lib/l10n');

const TARGET_LANGS = ['en', 'ja'];

// ── CLI parsing ──
const args = process.argv.slice(2);
const isDry = args.includes('--dry');
const skipLlm = args.includes('--skip-llm');
const retranslateIdx = args.indexOf('--retranslate');
const retranslateKey = retranslateIdx >= 0 ? args[retranslateIdx + 1] : null;

// ── Helpers ──
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function unflattenDotPath(flat) {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur)) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

// ── Main ──
async function main() {
  console.log('📖 讀取 canonical...');
  const zhRaw = readJson(CANONICAL['zh-TW']);
  const zhFlat = flattenDotPath(zhRaw);
  const cache = existsSync(CACHE_PATH)
    ? readJson(CACHE_PATH)
    : { version: 1, hashes: {}, locked: {} };

  // 1. Diff
  const diff = diffCanonical(cache.hashes, zhFlat);
  console.log(`📊 Diff: +${diff.added.length} ~${diff.changed.length} -${diff.removed.length}`);
  if (diff.added.length) console.log('   新增:', diff.added.slice(0, 10));
  if (diff.changed.length) console.log('   變動:', diff.changed.slice(0, 10));
  if (diff.removed.length) console.log('   刪除:', diff.removed.slice(0, 10));

  let keysNeedingTranslation = [...diff.added, ...diff.changed];
  if (retranslateKey) {
    if (!(retranslateKey in zhFlat)) {
      throw new Error(`--retranslate key not found: ${retranslateKey}`);
    }
    keysNeedingTranslation.push(retranslateKey);
  }
  // 過濾掉 locked key
  keysNeedingTranslation = keysNeedingTranslation.filter(
    (k) => !cache.locked?.[k]
  );

  if (isDry) {
    console.log('💡 --dry 模式，檢查是否 in-sync...');
    const outOfSync = diff.added.length + diff.changed.length + diff.removed.length > 0;
    for (const lang of ['zh-TW', 'en', 'ja']) {
      const msgPath = join(WEB_MESSAGES_DIR, `${lang}.json`);
      if (!existsSync(msgPath)) {
        console.error(`❌ 生成檔缺少: ${msgPath}`);
        process.exit(1);
      }
    }
    if (outOfSync) {
      console.error('❌ canonical 與 cache 不同步，請跑 `npm run i18n:sync`');
      process.exit(1);
    }
    console.log('✅ In sync');
    return;
  }

  // 2. 讀舊的 en/ja（保留未 changed 的）
  const enFlat = flattenDotPath(readJson(CANONICAL.en));
  const jaFlat = flattenDotPath(readJson(CANONICAL.ja));

  // 刪除 removed key
  for (const k of diff.removed) {
    delete enFlat[k];
    delete jaFlat[k];
  }

  // 3. LLM 翻譯增量
  if (keysNeedingTranslation.length > 0 && !skipLlm) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    for (const lang of TARGET_LANGS) {
      console.log(`🌐 翻譯 → ${lang} (${keysNeedingTranslation.length} keys)...`);
      const translated = await translateIncremental({
        client,
        source: zhFlat,
        targetLang: lang,
        keysToTranslate: keysNeedingTranslation,
      });
      const target = lang === 'en' ? enFlat : jaFlat;
      Object.assign(target, translated);
    }
  } else if (skipLlm) {
    console.log('⏭️  --skip-llm，保留現有 en/ja');
  }

  // 4. 寫回 canonical en/ja（巢狀格式）
  writeJson(CANONICAL.en, unflattenDotPath(enFlat));
  writeJson(CANONICAL.ja, unflattenDotPath(jaFlat));

  // 5. Transpile → Web messages (next-intl 讀巢狀 JSON)
  writeJson(join(WEB_MESSAGES_DIR, 'zh-TW.json'), unflattenDotPath(zhFlat));
  writeJson(join(WEB_MESSAGES_DIR, 'en.json'), unflattenDotPath(enFlat));
  writeJson(join(WEB_MESSAGES_DIR, 'ja.json'), unflattenDotPath(jaFlat));
  console.log('📝 Wrote src/messages/*.json');

  // 6. Transpile → Mobile ARB
  const zhArb = buildArbJson(buildArbKeyMap(zhFlat), 'zh');
  const enArb = buildArbJson(buildArbKeyMap(enFlat), 'en');
  const jaArb = buildArbJson(buildArbKeyMap(jaFlat), 'ja');
  writeJson(join(MOBILE_L10N_DIR, 'app_zh.arb'), zhArb);
  writeJson(join(MOBILE_L10N_DIR, 'app_en.arb'), enArb);
  writeJson(join(MOBILE_L10N_DIR, 'app_ja.arb'), jaArb);
  console.log('📱 Wrote mobile/lib/l10n/*.arb');

  // 7. Update cache
  const newHashes = {};
  for (const [k, v] of Object.entries(zhFlat)) {
    newHashes[k] = hashValue(v);
  }
  cache.hashes = newHashes;
  writeJson(CACHE_PATH, cache);
  console.log('💾 Cache updated');

  console.log('✅ Sync 完成');
}

main().catch((err) => {
  console.error('❌', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
