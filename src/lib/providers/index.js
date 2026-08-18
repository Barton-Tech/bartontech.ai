import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as google from './google.js';

export const PROVIDERS = { anthropic, openai, google };

export function enabledProviders(config) {
  return Object.entries(config.providers)
    .filter(([, cfg]) => cfg.enabled)
    .map(([name, cfg]) => ({ name, cfg, impl: PROVIDERS[name] }));
}

export function assertConfigured(config) {
  const bad = [];
  for (const [name, cfg] of Object.entries(config.providers)) {
    if (!cfg.enabled) continue;
    for (const [tier, id] of Object.entries(cfg.models)) {
      if (!id || id === 'REPLACE_ME') bad.push(`${name}.${tier}`);
    }
  }
  if (bad.length) {
    throw new Error(
      `Unconfigured model ids in config/models.json: ${bad.join(', ')}. ` +
        'Replace the placeholders, or set enabled:false for that provider.',
    );
  }
}
