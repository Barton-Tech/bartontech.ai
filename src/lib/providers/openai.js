import OpenAI from 'openai';

// Runs inline rather than through a batch API. Submitted work is executed at
// submit time with a small concurrency cap and the results are stored in the
// pending file, so the collect stage treats every provider the same way.

const CONCURRENCY = 4;

let client;
function getClient() {
  client ??= new OpenAI();
  return client;
}

// Fill this in to enable the grounded pass on this provider. Until it returns
// a tool definition, grounded requests are recorded with grounded:false rather
// than being silently passed off as web-grounded.
export function webSearchTool() {
  return null;
}

async function runOne(req, providerConfig) {
  const grounded = req.grounded && webSearchTool() !== null;
  const body = {
    model: providerConfig.models[req.tier],
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'extraction', strict: true, schema: req.schema },
    },
  };
  if (grounded) body.tools = [webSearchTool()];

  try {
    const res = await getClient().chat.completions.create(body);
    const text = res.choices?.[0]?.message?.content;
    if (!text) return { custom_id: req.custom_id, ok: false, error: 'empty_response' };
    return {
      custom_id: req.custom_id,
      ok: true,
      data: JSON.parse(text),
      raw: text,
      model: res.model,
      usage: res.usage ?? null,
      grounded_actual: grounded,
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
