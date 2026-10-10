'use strict';

const ALLOWED_METHODS = Object.freeze({
  getSoftwareAppData: 0,
  createWorkshopFromSoftware: 1,
  updateWorkshopFromSoftware: 2,
  updateParticipantFromSoftware: 2,
  setWorkshopLifecycleFromSoftware: 2,
  retryEmailFromSoftware: 1,
  sendCustomEmailFromSoftware: 1,
  startTestFromSoftware: 1,
  saveSoftwareSettings: 1,
  runSchedulerFromSoftware: 0,
  runReadinessFromSoftware: 0,
  registerCertificateMasterFromSoftware: 0,
  setupFromSoftware: 0,
});

const GOOGLE_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);
const MAX_BODY_BYTES = 512 * 1024;
const UPSTREAM_TIMEOUT_MS = 40000;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.end(JSON.stringify(payload));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseRequestBody(req) {
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return { error: 'Request body must be valid JSON.' };
    }
  }
  if (!isPlainObject(body)) return { error: 'Request body must be a JSON object.' };
  return { body };
}

function validAppsScriptUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    const validPath = /^\/(?:macros\/s\/[^/]+\/exec|a\/macros\/[^/]+\/s\/[^/]+\/exec)\/?$/.test(url.pathname);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !validPath || url.hostname !== 'script.google.com') return null;
    return url;
  } catch (_) {
    return null;
  }
}

function validateOperation(method, args) {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_METHODS, method)) {
    return 'This operation is not allowed by the hosted API.';
  }
  if (!Array.isArray(args) || args.length !== ALLOWED_METHODS[method]) {
    return 'Invalid arguments for the requested operation.';
  }
  switch (method) {
    case 'createWorkshopFromSoftware':
    case 'sendCustomEmailFromSoftware':
    case 'startTestFromSoftware':
    case 'saveSoftwareSettings':
      if (!isPlainObject(args[0])) return 'The operation payload must be a JSON object.';
      break;
    case 'updateWorkshopFromSoftware':
      if (typeof args[0] !== 'string' || !args[0].trim() || !isPlainObject(args[1])) return 'Invalid workshop update payload.';
      break;
    case 'updateParticipantFromSoftware':
      if (typeof args[0] !== 'string' || !args[0].trim() || !['REGISTERED', 'APPROVED', 'ON_HOLD', 'REMOVED', 'REJECTED'].includes(args[1])) {
        return 'Invalid participant status update.';
      }
      break;
    case 'setWorkshopLifecycleFromSoftware':
      if (typeof args[0] !== 'string' || !args[0].trim() || !['CANCELLED', 'ARCHIVED'].includes(args[1])) {
        return 'Invalid workshop lifecycle action.';
      }
      break;
    case 'retryEmailFromSoftware':
      if (typeof args[0] !== 'string' || !args[0].trim() || args[0].length > 256) return 'Invalid email job identifier.';
      break;
    default:
      break;
  }
  return '';
}

function assertAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(forwardedHost);
    const forwardedProto = String(req.headers['x-forwarded-proto'] || (localHost ? 'http' : 'https')).split(',')[0].trim();
    return originUrl.origin === `${forwardedProto}://${forwardedHost}`;
  } catch (_) {
    return false;
  }
}

async function fetchAppsScript(startUrl, payload, signal) {
  let url = new URL(startUrl.href);
  let method = 'POST';
  let body = JSON.stringify(payload);
  let headers = { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json, text/plain;q=0.9, */*;q=0.5' };

  for (let hop = 0; hop <= 3; hop += 1) {
    const response = await fetch(url, { method, headers, body, redirect: 'manual', cache: 'no-store', signal });
    const location = response.headers.get('location');
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) return response;
    if (hop === 3) throw new Error('Google Apps Script returned too many redirects.');

    let nextUrl;
    try {
      nextUrl = new URL(location, url);
    } catch (_) {
      throw new Error('Google Apps Script returned an invalid redirect.');
    }
    if (nextUrl.protocol !== 'https:' || !GOOGLE_HOSTS.has(nextUrl.hostname) || nextUrl.username || nextUrl.password) {
      throw new Error('Google Apps Script redirected to an untrusted destination.');
    }

    // ContentService intentionally redirects to a one-time googleusercontent.com URL.
    // For 301/302/303, follow Fetch's POST-to-GET behavior after the doPost has run.
    if ([301, 302, 303].includes(response.status)) {
      method = 'GET';
      body = undefined;
      headers = { Accept: 'application/json, text/plain;q=0.9, */*;q=0.5' };
    }
    url = nextUrl;
  }
  throw new Error('Unable to complete the Google Apps Script redirect.');
}

module.exports = async function workshopApi(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed. Use POST.' });
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return json(res, 415, { ok: false, error: 'Content-Type must be application/json.' });
  }
  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(res, 413, { ok: false, error: 'Request payload is too large.' });
  }
  if (!assertAllowedOrigin(req)) {
    return json(res, 403, { ok: false, error: 'Cross-origin requests are not accepted.' });
  }

  const parsed = parseRequestBody(req);
  if (parsed.error) return json(res, 400, { ok: false, error: parsed.error });
  const bodyBytes = Buffer.byteLength(JSON.stringify(parsed.body), 'utf8');
  if (bodyBytes > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: 'Request payload is too large.' });
  const { method, token, args } = parsed.body;

  if (typeof method !== 'string' || method.length > 100) {
    return json(res, 400, { ok: false, error: 'A valid RPC method is required.' });
  }
  if (typeof token !== 'string' || !token.trim() || token.length > 4096) {
    return json(res, 401, { ok: false, error: 'A valid software access token is required.' });
  }
  const validationError = validateOperation(method, args);
  if (validationError) return json(res, 400, { ok: false, error: validationError });

  const appsScriptUrl = validAppsScriptUrl(process.env.APPS_SCRIPT_WEB_APP_URL);
  if (!appsScriptUrl) {
    return json(res, 503, {
      ok: false,
      error: 'The hosted API is not configured. Set APPS_SCRIPT_WEB_APP_URL to the deployed Google Apps Script web app URL ending in /exec.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetchAppsScript(appsScriptUrl, { method, token: token.trim(), args }, controller.signal);
    let payload;
    try {
      payload = JSON.parse(await upstream.text());
    } catch (_) {
      return json(res, 502, {
        ok: false,
        error: 'Google Apps Script returned a non-JSON response. Confirm its doPost handler returns the expected JSON envelope.',
      });
    }

    if (!upstream.ok) {
      const message = isPlainObject(payload) && typeof payload.error === 'string'
        ? payload.error
        : `Google Apps Script returned HTTP ${upstream.status}.`;
      return json(res, 502, { ok: false, error: message });
    }

    // Preserve the upstream success/error envelope unchanged for the existing dashboard client.
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    return res.end(JSON.stringify(payload));
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    return json(res, timedOut ? 504 : 502, {
      ok: false,
      error: timedOut
        ? 'Google Apps Script did not respond before the hosted API timeout. The operation may still have completed; verify its state before trying again.'
        : 'Could not reach the configured Google Apps Script web app. Check the deployment URL, access settings, and network availability.',
    });
  } finally {
    clearTimeout(timeout);
  }
};

