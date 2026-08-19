import Anthropic from '@anthropic-ai/sdk';

// Daily work goes through the Message Batches API: a flat 50% discount, and
// latency is irrelevant for a once-a-day job. Results come back in arbitrary
// order, so everything is keyed by custom_id and never by position.

const MAX_TOKENS = { bulk: 4000, grounded: 8000, reasoning: 16000 };

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

function buildParams(req, providerConfig) {
  const model = providerConfig.models[req.tier];
  const params = {
    model,
    max_tokens: MAX_TOKENS[req.tier] ?? 4000,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
    output_config: {
      format: { type: 'json_schema', schema: req.schema },
    },
  };

  if (req.grounded) {
    // The current web-search variant carries dynamic filtering and needs
    // Sonnet 5 or above, which is why the grounded tier is not on Haiku.
    params.tools = [{ type: 'web_search_20260209', name: 'web_search' }];
    // Extraction work, not deep reasoning. Medium keeps it searching without
    // paying for deliberation the task does not need.
    params.output_config.effort = 'medium';
  }

  return params;
}

export async function submit(requests, { providerConfig }) {
  if (requests.length === 0) return { kind: 'inline', results: [] };

  const batch = await getClient().messages.batches.create({
    requests: requests.map((req) => ({
      custom_id: req.custom_id,
      params: buildParams(req, providerConfig),
    })),
  });

  return { kind: 'batch', id: batch.id, count: requests.length };
}

export async function collect(handle) {
  if (handle.kind === 'inline') return { ready: true, results: handle.results };

  const api = getClient();
  const batch = await api.messages.batches.retrieve(handle.id);
  if (batch.processing_status !== 'ended') {
    return { ready: false, status: batch.processing_status };
  }

  const results = [];
  for await (const entry of await api.messages.batches.results(handle.id)) {
    if (entry.result.type !== 'succeeded') {
      results.push({
        custom_id: entry.custom_id,
        ok: false,
        error: entry.result.type,
      });
      continue;
    }

    const message = entry.result.message;
    const text = message.content.find((b) => b.type === 'text')?.text;

    // A refusal returns HTTP 200 with an empty or partial content array, so
    // stop_reason is checked before the payload is trusted.
    if (message.stop_reason === 'refusal' || !text) {
      results.push({
        custom_id: entry.custom_id,
        ok: false,
        error: message.stop_reason === 'refusal' ? 'refusal' : 'empty_response',
      });
      continue;
    }

    try {
      results.push({
        custom_id: entry.custom_id,
        ok: true,
        data: JSON.parse(text),
        raw: text,
        model: message.model,
        usage: message.usage,
      });
    } catch {
      results.push({ custom_id: entry.custom_id, ok: false, error: 'parse_error', raw: text });
    }
  }

  return { ready: true, results };
}

// Web-search citations arrive as citation entries on the content blocks, not
// inside the schema payload, and models under-report their own sources. The
// other two providers already merge; this keeps the three source lists
// comparable.
function citationUrls(message) {
  const urls = [];
  for (const block of message.content ?? []) {
    for (const c of block.citations ?? []) {
      if (c.url) urls.push(c.url);
    }
  }
  return urls;
}

// Single synchronous call, used by the monthly job where there is nothing to
// batch and the result is needed immediately.
export async function once(req, { providerConfig }) {
  const params = buildParams(req, providerConfig);
  const message = await getClient().messages.create(params);

  if (message.stop_reason === 'refusal') {
    return { ok: false, error: 'refusal', detail: message.stop_details ?? null };
  }
  const text = message.content.find((b) => b.type === 'text')?.text;
  if (!text) return { ok: false, error: 'empty_response' };

  try {
    const data = JSON.parse(text);
    const urls = citationUrls(message);
    if (urls.length) {
      data.sources = [...new Set([...(Array.isArray(data.sources) ? data.sources : []), ...urls])];
    }
    return { ok: true, data, model: message.model, usage: message.usage };
  } catch {
    return { ok: false, error: 'parse_error', raw: text };
  }
}
