import { GoogleGenAI } from '@google/genai';

// The grounded pass enables Google Search grounding. Combining grounding with
// a response schema is supported on the Gemini 3 series, which every model in
// config/models.json belongs to; on an older model the two are mutually
// exclusive and the request would fail.

const CONCURRENCY = 4;

let client;
function getClient() {
  client ??= new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  return client;
}

// This provider's schema dialect is an OpenAPI subset and rejects
// additionalProperties, so it is stripped on the way in. Everything else in
// these schemas (enums, nested objects, arrays, required) is accepted.
function adaptSchema(node) {
  if (Array.isArray(node)) return node.map(adaptSchema);
  if (node === null || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'additionalProperties') continue;
    out[key] = adaptSchema(value);
  }
  return out;
}

// Grounding citations live in groundingMetadata rather than in the schema
// payload, so they are merged with whatever the model reported itself.
function groundingUrls(response) {
  const urls = [];
  for (const candidate of response.candidates ?? []) {
    for (const chunk of candidate.groundingMetadata?.groundingChunks ?? []) {
      if (chunk.web?.uri) urls.push(chunk.web.uri);
    }
  }
  return urls;
}

async function runOne(req, providerConfig) {
  const config = {
    systemInstruction: req.system,
    responseMimeType: 'application/json',
    responseSchema: adaptSchema(req.schema),
  };
  if (req.grounded) config.tools = [{ googleSearch: {} }];

  try {
    const res = await getClient().models.generateContent({
      model: providerConfig.models[req.tier],
      contents: req.user,
      config,
    });
    const text = res.text;
    if (!text) return { custom_id: req.custom_id, ok: false, error: 'empty_response' };

    const data = JSON.parse(text);
    const sources = [...new Set([...(data.sources ?? []), ...groundingUrls(res)])];

    return {
      custom_id: req.custom_id,
      ok: true,
      data: { ...data, sources },
      raw: text,
      model: providerConfig.models[req.tier],
      usage: res.usageMetadata ?? null,
      grounded_actual: Boolean(req.grounded),
    };
  } catch (err) {
    return { custom_id: req.custom_id, ok: false, error: String(err?.message ?? err) };
  }
}

async function pool(items, worker) {
  const out = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return out;
}

export async function submit(requests, { providerConfig }) {
  const results = await pool(requests, (req) => runOne(req, providerConfig));
  return { kind: 'inline', results };
}

export async function collect(handle) {
  return { ready: true, results: handle.results ?? [] };
}

export async function once(req, { providerConfig }) {
  const [res] = await pool([req], (r) => runOne(r, providerConfig));
  return res;
}
