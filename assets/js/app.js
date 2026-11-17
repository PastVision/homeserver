import {
  DEFAULT_CONFIG,
  validateConfigInput,
  normalizeBackendUrl,
  configPayload,
} from './config.js';
import { toStremioUrl, copyText, describeError } from './installer.js';

const $ = (id) => document.getElementById(id);

const form = $('configForm');
const provisionButton = $('provisionButton');
const formMessage = $('formMessage');
const connectionPill = $('connectionPill');
const result = $('result');
const resultId = $('resultId');
const resultRelay = $('resultRelay');
const manifestUrlInput = $('manifestUrl');
const installLink = $('installLink');
const revokeMessage = $('revokeMessage');

const fields = {
  backendUrl: $('backendUrl'),
  adminSecret: $('adminSecret'),
  label: $('label'),
  mediaServerBaseUrl: $('mediaServerBaseUrl'),
  movieEndpoint: $('movieEndpoint'),
  tvEndpoint: $('tvEndpoint'),
  timeoutMs: $('timeoutMs'),
  relayPublicBaseUrl: $('relayPublicBaseUrl'),
  installationId: $('installationId'),
};

function setValues(values) {
  for (const [key, input] of Object.entries(fields)) {
    if (input && values[key] !== undefined) input.value = values[key];
  }
}

function readValues() {
  return Object.fromEntries(
    Object.entries(fields).map(([key, input]) => [key, input ? input.value : '']),
  );
}

function clearErrors() {
  form.querySelectorAll('.error').forEach((node) => {
    node.textContent = '';
  });
  form.querySelectorAll('.field.invalid').forEach((node) => {
    node.classList.remove('invalid');
  });
}

function showErrors(errors) {
  clearErrors();
  for (const [key, message] of Object.entries(errors)) {
    const node = form.querySelector(`[data-error-for="${key}"]`);
    if (node) node.textContent = message;
    const input = fields[key];
    if (input) input.closest('.field')?.classList.add('invalid');
  }
}

function setBusy(busy) {
  provisionButton.disabled = busy;
  provisionButton.textContent = busy
    ? 'Provisioning…'
    : fields.installationId.value.trim()
      ? 'Update installation'
      : 'Create installation';
}

function setMessage(text, kind = '') {
  formMessage.textContent = text;
  formMessage.className = `form-message${kind ? ` ${kind}` : ''}`;
}

function setStatus(text, kind = '') {
  connectionPill.textContent = text;
  connectionPill.className = `status-pill${kind ? ` ${kind}` : ''}`;
}

async function parseResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const code = body?.code || body?.error || `HTTP_${response.status}`;
    const error = new Error(body?.message || friendlyCode(code, response.status));
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return body;
}

function friendlyCode(code, status) {
  const messages = {
    ADMIN_UNAUTHORIZED: 'The administrative setup secret was rejected.',
    PROVISIONING_DISABLED: 'Provisioning is disabled on this backend. Configure ADMIN_SETUP_SECRET.',
    CONFIG_REQUIRED: 'The backend did not receive a configuration.',
    INVALID_JSON: 'The backend rejected the request body.',
    MEDIA_HOST_NOT_ALLOWED: 'That media-server host is not on the backend allowlist.',
    PRIVATE_MEDIA_HOST_NOT_ALLOWED: 'Private media hosts require an explicit backend allowlist entry.',
    RELAY_HTTPS_REQUIRED: 'The backend requires an HTTPS relay URL.',
    ORIGIN_NOT_ALLOWED: 'This website origin is not allowed by the backend CORS policy.',
    INSTALLATION_NOT_FOUND: 'That installation does not exist or is already revoked.',
    RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
    STORE_UNAVAILABLE: 'The backend configuration store is unavailable.',
  };
  return messages[code] || `The backend returned HTTP ${status}.`;
}

async function provision(event) {
  event.preventDefault();
  const values = readValues();
  const errors = validateConfigInput(values);
  if (Object.keys(errors).length) {
    showErrors(errors);
    setMessage('Check the highlighted fields.', 'error');
    return;
  }
  clearErrors();
  setBusy(true);
  setMessage('Contacting the backend provisioning endpoint…');
  setStatus('Provisioning…');
  try {
    const backend = normalizeBackendUrl(values.backendUrl);
    const payload = {
      label: values.label.trim() || 'Home Server',
      config: configPayload(values),
    };
    const installationId = values.installationId.trim();
    if (installationId) payload.installationId = installationId;

    const response = await fetch(`${backend}/api/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': values.adminSecret,
      },
      body: JSON.stringify(payload),
    });
    const body = await parseResponse(response);
    fields.adminSecret.value = '';
    setMessage(
      installationId
        ? 'Installation updated. Reinstall the manifest link if Stremio still shows the old configuration.'
        : 'Installation created. Continue with the Stremio link below.',
      'success',
    );
    setStatus('Backend reachable', 'success');
    showResult(body);
    $('install').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setStatus('Backend error');
    setMessage(describeError(error), 'error');
  } finally {
    setBusy(false);
  }
}

function showResult(body) {
  result.hidden = false;
  resultId.textContent = body.installationId || '';
  resultRelay.textContent = body.relayPublicUrl || 'Configured by the backend';
  manifestUrlInput.value = body.manifestUrl || '';
  const stremio = body.manifestUrl ? toStremioUrl(body.manifestUrl) : '#';
  installLink.href = stremio;
  installLink.dataset.stremio = stremio;
  if (fields.installationId && body.installationId) {
    fields.installationId.value = body.installationId;
    setBusy(false);
  }
}

async function revoke() {
  const id = $('revokeId').value.trim();
  const secret = $('revokeSecret').value;
  const backend = normalizeBackendUrl(fields.backendUrl.value);
  revokeMessage.textContent = '';
  revokeMessage.className = 'form-message';
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) {
    revokeMessage.textContent = 'Enter a valid 43-character installation ID.';
    revokeMessage.className = 'form-message error';
    return;
  }
  if (!secret) {
    revokeMessage.textContent = 'Enter the administrative setup secret.';
    revokeMessage.className = 'form-message error';
    return;
  }
  if (!backend) {
    revokeMessage.textContent = 'Enter a valid backend URL above.';
    revokeMessage.className = 'form-message error';
    return;
  }
  $('revokeButton').disabled = true;
  try {
    const response = await fetch(`${backend}/api/installations/${encodeURIComponent(id)}/revoke`, {
      method: 'POST',
      headers: { 'X-Admin-Secret': secret },
    });
    await parseResponse(response);
    revokeMessage.textContent = 'Installation revoked. Existing playback capabilities for it are invalidated.';
    revokeMessage.className = 'form-message success';
    $('revokeSecret').value = '';
    if (fields.installationId.value.trim() === id) {
      fields.installationId.value = '';
    }
  } catch (error) {
    revokeMessage.textContent = describeError(error);
    revokeMessage.className = 'form-message error';
  } finally {
    $('revokeButton').disabled = false;
  }
}

async function copyValue(value, button, label) {
  const original = button.textContent;
  try {
    await copyText(value);
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = original; }, 1400);
  } catch {
    button.textContent = 'Copy failed';
    setTimeout(() => { button.textContent = original; }, 1400);
  }
}

form.addEventListener('submit', provision);
$('revokeButton').addEventListener('click', revoke);
$('resetButton').addEventListener('click', () => {
  form.reset();
  setValues({ ...DEFAULT_CONFIG, label: '', installationId: '' });
  fields.adminSecret.value = '';
  clearErrors();
  setMessage('');
  setStatus('Backend not checked');
  result.hidden = true;
});
$('copyManifest').addEventListener('click', (event) => {
  copyValue(manifestUrlInput.value, event.currentTarget, 'manifest');
});
$('copyInstall').addEventListener('click', (event) => {
  const value = installLink.dataset.stremio || installLink.href;
  copyValue(value, event.currentTarget, 'install');
});
fields.installationId.addEventListener('input', () => {
  provisionButton.textContent = fields.installationId.value.trim()
    ? 'Update installation'
    : 'Create installation';
});

setValues({ ...DEFAULT_CONFIG, label: '', installationId: '' });
