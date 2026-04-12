const LANG_NAMES = {
  en: 'English',
  ja: '日本語 (Japanese)',
};

function buildPrompt({ source, targetLang, keysToTranslate }) {
  const langName = LANG_NAMES[targetLang] || targetLang;
  const fullSource = JSON.stringify(source, null, 2);
  const keyList = keysToTranslate.map((k) => `- ${k}`).join('\n');

  return `你是 Nudge 這款個人生產力 App 的 UI 文案翻譯師。

Nudge 是繁中 UI，現在要多語化支援 ${langName}。我會給你完整的繁中 canonical 檔（JSON，dot-path key），你只翻譯指定清單裡的 key。

規則：
1. 翻成 ${langName}，語氣：簡短、動詞優先、非官方口吻（像寫給朋友的 App）
2. 保留 ICU MessageFormat placeholder（\`{name}\`、\`{count, plural, ...}\`）完全不動
3. 按鈕和 label 優先用動詞/名詞短語，不寫完整句子
4. 只翻指定的 key，其他略過
5. 回覆必須是純 JSON（key → 翻譯後字串），不要任何額外說明

完整 canonical 檔（繁中）：
\`\`\`json
${fullSource}
\`\`\`

要翻譯的 key（只翻這些）：
${keyList}

輸出格式（純 JSON）：
{
  "key1": "翻譯",
  "key2": "翻譯"
}`;
}

function extractJson(text) {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  try {
    return JSON.parse(raw.trim());
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${e.message}\nResponse: ${text}`);
  }
}

/**
 * @param opts.client Anthropic SDK client
 * @param opts.source {Record<string, string>}  完整 canonical (dot-path → zh-TW)
 * @param opts.targetLang 'en' | 'ja'
 * @param opts.keysToTranslate {string[]}  只翻這些
 * @returns {Promise<Record<string, string>>}  已翻譯的 key → value
 */
export async function translateIncremental({
  client,
  source,
  targetLang,
  keysToTranslate,
}) {
  if (keysToTranslate.length === 0) return {};

  const prompt = buildPrompt({ source, targetLang, keysToTranslate });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return extractJson(text);
}
