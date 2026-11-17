export function toStremioUrl(manifestUrl) {
  const parsed = new URL(manifestUrl);
  return `stremio://${parsed.host}${parsed.pathname}${parsed.search}`;
}

export async function copyText(text) {
  if (!text) throw new Error('nothing to copy');
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('copy failed');
}

export function describeError(error) {
  if (!error) return 'The request failed.';
  if (error.name === 'TypeError') {
    return 'Could not reach the backend. Check the URL, HTTPS certificate and CORS configuration.';
  }
  return error.message || 'The request failed.';
}

export default { toStremioUrl, copyText, describeError };
