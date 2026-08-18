import OpenAI from 'openai';

// Runs inline rather than through a batch API. Submitted work is executed at
// submit time with a small concurrency cap and the results are stored in the
// pending file, so the collect stage treats every provider the same way.
//
// Both passes use the Responses API. The web_search tool is Responses-only:
// Chat Completions can only reach web search through separate specialised
// search models, which are not the models configured here. Using one endpoint
// for both passes keeps a single request shape and a single extraction path.

const CONCURRENCY = 4;

let client;
function getClient() {
  client ??= new OpenAI();
  return client;
}

// Citations arrive as url_citation annotations on the output text rather than
// inside the schema, so they are merged with whatever the model reported in
// the schema's own sources array.
function annotationUrls(response) {
  const urls = [];
  for (const item of response.output ?? []) {
    for (const part of item.content ?? []) {
      for (const note of part.annotations ?? []) {
        if (note.type === 'url_citation' && note.url) urls.push(note.url);
      }
    }
  }
  return urls;
}

async function runOne(req, providerConfig) {
  const body = {
    model: providerConfig.models[req.tier],
    input: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'extraction',
        strict: true,
        schema: req.schema,
      },
    },
  };
  if (req.grounded) body.tools = [{ type: 'web_search' }];

  try {
    const res = await getClient().responses.create(body);
    const text = res.output_text;
    if (!text) return { custom_id: req.custom_id, ok: false, error: 'empty_response' };

    const data = JSON.parse(text);
    const sources = [...new Set([...(data.sources ?? []), ...annotationUrls(res)])];

    return {
      custom_id: req.custom_id,
      ok: true,
      data: { ...data, sources },
      raw: text,
      model: res.model,
      usage: res.usage ?? null,
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
