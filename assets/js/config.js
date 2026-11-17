/**
 * Public website configuration schema and validation.
 *
 * Keep this aligned with addon/src/config.js. The backend remains the final
 * authority; this validation is only for fast, friendly feedback.
 */

export const DEFAULT_CONFIG = Object.freeze({
  mediaServerBaseUrl: 'https://vidsrc.mov/embed',
  movieEndpoint: '/movie/{imdb_id}',
  tvEndpoint: '/tv/{imdb_id}/{season}/{episode}',
  timeoutMs: '15000',
  relayPublicBaseUrl: '',
});

export const INSTALLATION_ID_RE = /^[A-Za-z0-9_-]{43}$/;

function parseUrl(value) {
  try {
    return new URL(String(value).trim());
  } catch {
    return null;
  }
}

function isLoopbackHost(host) {
  const value = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  return value === 'localhost' || value === '127.0.0.1' || value === '::1';
}

export function normalizeBackendUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return '';
  return parsed.href.replace(/\/+$/, '');
}

export function validateBackendUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return 'Enter a valid backend URL.';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname))) {
    return 'Use HTTPS for a public backend; HTTP is allowed only for localhost testing.';
  }
  if (parsed.username || parsed.password) return 'The backend URL must not contain credentials.';
  if (parsed.search || parsed.hash) return 'The backend URL must not contain a query or fragment.';
  return '';
}

export function validateMediaServerUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return 'Enter a valid media server URL.';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname))) {
    return 'Use HTTPS for a public media server; HTTP is allowed only for localhost testing.';
  }
  if (parsed.username || parsed.password) return 'The media server URL must not contain credentials.';
  if (parsed.search || parsed.hash) return 'The media server URL must not contain a query or fragment.';
  return '';
}

export function validateRelayUrl(value) {
  if (!String(value || '').trim()) return '';
  const parsed = parseUrl(value);
  if (!parsed) return 'Enter a valid relay URL or leave it blank.';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname))) {
    return 'Use HTTPS for a remote relay; HTTP is allowed only for localhost testing.';
  }
  if (parsed.username || parsed.password) return 'The relay URL must not contain credentials.';
  if (parsed.search || parsed.hash) return 'The relay URL must not contain a query or fragment.';
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    return 'The relay URL must be an origin without a path.';
  }
  return '';
}

export function validateTemplate(value, required) {
  const template = String(value || '').trim();
  if (!template) return 'This template is required.';
  if (!template.startsWith('/')) return 'The template must start with /.';
  if (template.startsWith('//')) return 'The template must be a path, not a URL.';
  if (template.includes('\\') || template.includes('?') || template.includes('#')) {
    return 'The template must not contain backslashes, queries or fragments.';
  }
  if (template.split('/').includes('..')) return 'The template must not contain .. segments.';
  for (const placeholder of required) {
    if (!template.includes(`{${placeholder}}`)) return `The template must include {${placeholder}}.`;
  }
  const unknown = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  const allowed = new Set(required);
  for (const name of unknown) {
    if (!allowed.has(name)) return `Unknown placeholder {${name}}.`;
  }
  return '';
}

export function validateConfigInput(values) {
  const errors = {};
  const backendError = validateBackendUrl(values.backendUrl);
  if (backendError) errors.backendUrl = backendError;

  if (!String(values.adminSecret || '').trim()) {
    errors.adminSecret = 'Enter the administrative setup secret.';
  }

  const mediaError = validateMediaServerUrl(values.mediaServerBaseUrl);
  if (mediaError) errors.mediaServerBaseUrl = mediaError;

  const movieError = validateTemplate(values.movieEndpoint, ['imdb_id']);
  if (movieError) errors.movieEndpoint = movieError;
  const tvError = validateTemplate(values.tvEndpoint, ['imdb_id', 'season', 'episode']);
  if (tvError) errors.tvEndpoint = tvError;

  const timeout = Number(values.timeoutMs);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120000) {
    errors.timeoutMs = 'Use an integer between 1000 and 120000.';
  }

  const relayError = validateRelayUrl(values.relayPublicBaseUrl);
  if (relayError) errors.relayPublicBaseUrl = relayError;

  const id = String(values.installationId || '').trim();
  if (id && !INSTALLATION_ID_RE.test(id)) {
    errors.installationId = 'An installation ID must be 43 URL-safe characters.';
  }

  if (String(values.label || '').length > 80) {
    errors.label = 'Use 80 characters or fewer.';
  }

  return errors;
}

export function configPayload(values) {
  return {
    mediaServerBaseUrl: String(values.mediaServerBaseUrl).trim(),
    movieEndpoint: String(values.movieEndpoint).trim(),
    tvEndpoint: String(values.tvEndpoint).trim(),
    timeoutMs: String(values.timeoutMs).trim(),
    relayPublicBaseUrl: String(values.relayPublicBaseUrl || '').trim(),
  };
}

export default {
  DEFAULT_CONFIG,
  INSTALLATION_ID_RE,
  validateConfigInput,
  validateBackendUrl,
  normalizeBackendUrl,
  configPayload,
};
