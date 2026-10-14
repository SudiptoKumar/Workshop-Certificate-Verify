'use strict';

/*
 * api/workshop.js
 *
 * Vercel serverless adapter between the dashboard and the private Google Apps Script backend.
 *
 *   Browser dashboard
 *     -> POST /api/workshop   { method, token, args }
 *     -> this adapter
 *     -> POST to APPS_SCRIPT_WEB_APP_URL   (same JSON body, handled by doPost in Workshop_Automation.gs)
 *     -> { ok: true, data }  or  { ok: false, error }
 *     -> this adapter
 *     -> browser dashboard
 *
 * What this file does:
 *   - Accepts only POST with a JSON body.
 *   - Checks the request shape. Only the 20 known methods are allowed, each with the exact argument count and types.
 *   - Reads the Apps Script address from the APPS_SCRIPT_WEB_APP_URL environment variable. It is never sent to the browser.
 *   - Follows the Apps Script redirect safely (see "Redirect rule" below).
 *   - Always answers with JSON: { ok: true, data } or { ok: false, error }.
 *   - Never retries a request. A write that times out is reported as "may still be running".
 *   - Never logs the token, the arguments, the upstream text or the Apps Script address.
 *
 * What this file does not do:
 *   - It has no WORKSHOP business logic. All of that stays in Apps Script.
 *   - It does not check the token. The backend does that.
 *
 * Assumption (the private backend was not supplied, so this could not be tested against it):
 *   doPost(e) reads e.postData.contents as JSON { method, token, args } and answers with JSON
 *   { ok: true, data } or { ok: false, error }. This is the same shape the browser uses.
 *
 * Redirect rule:
 *   Apps Script runs doPost on the first request, then answers 302 to a script.googleusercontent.com address
 *   that only serves the result. The adapter follows that redirect with GET and no body and no token.
 *   It never sends the POST again, because that would run a write twice.
 *
 * Time limit:
 *   The default wait for Apps Script is 55 seconds, so the adapter can answer with clean JSON before a 60 second
 *   Vercel limit. If your Vercel plan allows a longer function time, raise "maxDuration" in vercel.json and
 *   set UPSTREAM_TIMEOUT_MS to a little less than it (allowed range 5000 to 290000).
 *
 * HTTP status used:
 *   200 success | 400 bad request or backend refused the action | 401 access denied | 405 wrong HTTP method
 *   413 body too large | 415 wrong content type | 500 hosting setup problem | 502 backend unreachable or unreadable
 *   504 backend too slow. The dashboard reads 401 as "sign out" and 504 on a write as "may still be running".
 */

/* ---------- the allowlist: exact names, argument count and argument types ---------- */
/* 'id' = non-empty text, 'object' = plain object. "write" marks every method that changes something. */
const METHODS = new Map([
  ['getSoftwareAppData',                   { write: false, args: [] }],
  ['createWorkshopFromSoftware',           { write: true,  args: ['object'] }],
  ['updateWorkshopFromSoftware',           { write: true,  args: ['id', 'object'] }],
  ['updateParticipantFromSoftware',        { write: true,  args: ['id', 'id'] }],
  ['setWorkshopLifecycleFromSoftware',     { write: true,  args: ['id', 'id'] }],
  ['retryEmailFromSoftware',               { write: true,  args: ['id'] }],
  ['sendCustomEmailFromSoftware',          { write: true,  args: ['object'] }],
  ['startTestFromSoftware',                { write: true,  args: ['object'] }],
  ['saveSoftwareSettings',                 { write: true,  args: ['object'] }],
  ['runSchedulerFromSoftware',             { write: true,  args: [] }],
  ['runReadinessFromSoftware',             { write: false, args: [] }],
  ['registerCertificateMasterFromSoftware', { write: true, args: [] }],
  ['setupFromSoftware',                    { write: true,  args: [] }],
  ['resetSoftwareAccessLinkFromSoftware',  { write: true,  args: [] }],
  ['reinstallSchedulerFromSoftware',       { write: true,  args: [] }],
  ['normalizeStableDefaultsFromSoftware',  { write: true,  args: [] }],
  ['hardDeleteWorkshopFromSoftware',       { write: true,  args: ['id'] }],
  ['repairRegistrationFormsFromSoftware',  { write: true,  args: [] }],
  ['findDuplicateRecordsFromSoftware',   { write: false, args: [] }],
  ['deleteCertificateFromSoftware',      { write: true,  args: ['id'] }],
]);

/* ---------- limits ---------- */
const MAX_REQUEST_BYTES = 1000000;      /* 1 MB. Real requests are far smaller. */
const MAX_RESPONSE_BYTES = 4200000;     /* Vercel allows about 4.5 MB in a function response. */
const MAX_TOKEN_CHARS = 1024;
const MAX_ID_CHARS = 500;
const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 55000;
const MIN_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 290000;
const REDIRECT_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);

const DEPLOY_HINT = 'Check that doPost was added to Workshop_Automation.gs, that a new Apps Script deployment was published, and that APPS_SCRIPT_WEB_APP_URL points to it.';
const WRITE_NOTE = ' The action may or may not have gone through. Refresh the data and check before you try again.';
const ACCESS_DENIED = /access denied|unauthori[sz]ed|invalid (access |software )?token/i;

/* ---------- small helpers ---------- */
class TooLargeError extends Error {}

function send(res, status, body, headers) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (headers) Object.keys(headers).forEach(k => res.setHeader(k, headers[k]));
  res.end(text);
}
const fail = (res, status, error, headers) => send(res, status, { ok: false, error }, headers);

/* One short line per failure. Only a fixed reason code and the checked method name. Nothing from the request or the backend. */
function logFailure(method, reason, status, startedAt) {
  try { console.error(JSON.stringify({ at: 'workshop-api', method: method || '-', reason, status, ms: Date.now() - startedAt })); } catch (_) { /* never break a response because of logging */ }
}

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function argOk(kind, value) {
  if (kind === 'object') return isPlainObject(value);
  if (kind === 'id') return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_ID_CHARS;
  return false;
}

/* Reads the request body with a size limit. Resolves with { tooLarge } or { text } or { parsed }. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) { req.resume(); return resolve({ tooLarge: true }); }
    if (req.readableEnded) {   /* a platform layer already read the stream */
      const b = req.body;
      if (typeof b === 'string') return resolve({ text: b });
      if (isPlainObject(b)) return resolve({ parsed: b });
      return resolve({ text: '' });
    }
    const chunks = [];
    let size = 0, over = false;
    req.on('data', chunk => {
      if (over) return;
      size += chunk.length;
      if (size > limit) { over = true; chunks.length = 0; return; }   /* keep draining, keep nothing */
      chunks.push(chunk);
    });
    req.on('end', () => resolve(over ? { tooLarge: true } : { text: Buffer.concat(chunks).toString('utf8') }));
    req.on('error', reject);
  });
}

/* The Apps Script address must be the deployed web app: https://script.google.com/.../exec */
function readUpstreamUrl(env) {
  const raw = String((env && env.APPS_SCRIPT_WEB_APP_URL) || '').trim();
  if (!raw) return { error: 'The hosted API is not set up yet. Add APPS_SCRIPT_WEB_APP_URL in the hosting environment variables and redeploy.' };
  let url;
  try { url = new URL(raw); } catch (_) { url = null; }
  if (!url || url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/\/exec$/.test(url.pathname) || url.username || url.password) {
    return { error: 'APPS_SCRIPT_WEB_APP_URL is not a valid Apps Script web app address. It must start with https://script.google.com/ and end with /exec.' };
  }
  return { url };
}

function readTimeout(opts, env) {
  const v = opts.timeoutMs !== undefined ? Number(opts.timeoutMs) : Number(env && env.UPSTREAM_TIMEOUT_MS);
  if (opts.timeoutMs !== undefined && Number.isFinite(v) && v > 0) return v;   /* explicit option is used as given (tests) */
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, v));
}

async function dropBody(resp) {
  try { if (resp && resp.body && typeof resp.body.cancel === 'function') await resp.body.cancel(); } catch (_) { /* ignore */ }
}

/* Reads the upstream answer as text with a size limit. */
async function readCapped(resp, limit) {
  const declared = Number(resp.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) { await dropBody(resp); throw new TooLargeError(); }
  if (!resp.body || typeof resp.body.getReader !== 'function') {
    const t = await resp.text();
    if (Buffer.byteLength(t) > limit) throw new TooLargeError();
    return t;
  }
  const reader = resp.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { try { await reader.cancel(); } catch (_) { /* ignore */ } throw new TooLargeError(); }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts).toString('utf8');
}

/*
 * Sends the request to Apps Script and returns one of:
 *   { type: 'response', status, text } | { type: 'timeout' } | { type: 'network' } | { type: 'too-large' }
 *   { type: 'bad-redirect' }           (redirect to an unexpected address, or too many redirects)
 *   { type: 'unexpected-redirect' }    (307 or 308, which would need the POST to be sent again: never done)
 */
async function callUpstream(fetchImpl, startUrl, bodyText, timeoutMs) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  try {
    let target = startUrl;
    let init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: bodyText, redirect: 'manual', signal: ctrl.signal };
    for (let hop = 0; ; hop++) {
      const resp = await fetchImpl(target.href, init);
      const st = resp.status;
      if (st === 301 || st === 302 || st === 303) {
        const loc = resp.headers.get('location');
        await dropBody(resp);
        if (hop >= MAX_REDIRECTS || !loc) return { type: 'bad-redirect' };
        let next;
        try { next = new URL(loc, target); } catch (_) { return { type: 'bad-redirect' }; }
        if (next.protocol !== 'https:' || !REDIRECT_HOSTS.has(next.hostname)) return { type: 'bad-redirect' };
        target = next;
        init = { method: 'GET', headers: { 'Accept': 'application/json' }, redirect: 'manual', signal: ctrl.signal };   /* no body, no token */
        continue;
      }
      if (st === 307 || st === 308) { await dropBody(resp); return { type: 'unexpected-redirect' }; }
      const text = await readCapped(resp, MAX_RESPONSE_BYTES);
      return { type: 'response', status: st, text };
    }
  } catch (e) {
    if (timedOut) return { type: 'timeout' };
    if (e instanceof TooLargeError) return { type: 'too-large' };
    return { type: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/* Makes the backend error a short plain text. */
function errorText(value) {
  let t = '';
  if (typeof value === 'string') t = value;
  else if (isPlainObject(value) && typeof value.message === 'string') t = value.message;
  t = t.trim().slice(0, 500);
  return t || 'The backend reported an error.';
}

/* ---------- the handler ---------- */
function createHandler(opts) {
  opts = opts || {};
  const fetchImpl = opts.fetchImpl || ((url, init) => fetch(url, init));

  return async function handler(req, res) {
    const startedAt = Date.now();
    const env = opts.env || process.env;

    if (req.method !== 'POST') { logFailure('', 'method-not-allowed', 405, startedAt); return fail(res, 405, 'Use POST for this endpoint.', { Allow: 'POST' }); }

    const ctype = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (ctype !== 'application/json') { logFailure('', 'content-type', 415, startedAt); return fail(res, 415, 'Send the request as application/json.'); }

    /* 1. read and parse the body */
    let body;
    try {
      const got = await readBody(req, MAX_REQUEST_BYTES);
      if (got.tooLarge) { logFailure('', 'body-too-large', 413, startedAt); return fail(res, 413, 'The request is too large.'); }
      if (got.parsed) body = got.parsed;
      else {
        try { body = JSON.parse(got.text); }
        catch (_) { logFailure('', 'bad-json', 400, startedAt); return fail(res, 400, 'The request body is not valid JSON.'); }
      }
    } catch (_) { logFailure('', 'body-read', 400, startedAt); return fail(res, 400, 'The request body could not be read.'); }

    /* 2. check the request shape */
    if (!isPlainObject(body) || typeof body.method !== 'string') { logFailure('', 'bad-shape', 400, startedAt); return fail(res, 400, 'The request must be a JSON object with a method name.'); }
    const spec = METHODS.get(body.method);
    if (!spec) { logFailure('', 'unsupported-method', 400, startedAt); return fail(res, 400, 'Unsupported operation.'); }
    const method = body.method;   /* safe to log: it is one of the allowlisted names */

    if (typeof body.token !== 'string' || body.token.trim() === '' || body.token.length > MAX_TOKEN_CHARS) {
      logFailure(method, 'token-missing', 401, startedAt);
      return fail(res, 401, 'Access denied. Enter the private software access token.');
    }
    const args = body.args === undefined ? [] : body.args;
    if (!Array.isArray(args) || args.length !== spec.args.length || !spec.args.every((kind, i) => argOk(kind, args[i]))) {
      logFailure(method, 'bad-args', 400, startedAt);
      return fail(res, 400, 'The request has the wrong arguments for this operation.');
    }

    /* 3. hosting setup */
    const cfg = readUpstreamUrl(env);
    if (cfg.error) { logFailure(method, 'not-configured', 500, startedAt); return fail(res, 500, cfg.error); }

    /* 4. call Apps Script, once, with exactly the same shape the browser used */
    const up = await callUpstream(fetchImpl, cfg.url, JSON.stringify({ method, token: body.token, args }), readTimeout(opts, env));
    const note = spec.write ? WRITE_NOTE : '';

    switch (up.type) {
      case 'timeout':
        logFailure(method, 'timeout', 504, startedAt);
        return fail(res, 504, spec.write
          ? 'The Apps Script backend took too long to answer. The action may still be running. Refresh the data and check before you try again.'
          : 'The Apps Script backend took too long to answer. Please try again.');
      case 'network':
        logFailure(method, 'network', 502, startedAt);
        return fail(res, 502, spec.write
          ? 'Could not confirm the result because the connection to the Apps Script backend failed.' + WRITE_NOTE
          : 'Could not reach the Apps Script backend. Please try again in a moment.');
      case 'too-large':
        logFailure(method, 'response-too-large', 502, startedAt);
        return fail(res, 502, 'The backend answer is too large for the hosted API (limit about 4 MB). Ask the backend to return less data.' + note);
      case 'bad-redirect':
      case 'unexpected-redirect':
        logFailure(method, up.type, 502, startedAt);
        return fail(res, 502, 'The Apps Script deployment sent the request to an unexpected address. Check that the web app is deployed with access set to "Anyone" and that APPS_SCRIPT_WEB_APP_URL is the latest /exec address.' + note);
      default: break;
    }

    /* 5. read the backend envelope */
    let envelope;
    try { envelope = JSON.parse(up.text); } catch (_) { envelope = null; }
    if (!isPlainObject(envelope) || typeof envelope.ok !== 'boolean' || (envelope.ok && up.status >= 400)) {
      logFailure(method, 'unreadable-upstream', 502, startedAt);
      return fail(res, 502, 'The Apps Script backend returned an unreadable answer (HTTP ' + up.status + '). ' + DEPLOY_HINT + note);
    }

    if (envelope.ok === false) {
      const message = errorText(envelope.error);
      const denied = ACCESS_DENIED.test(message);
      logFailure(method, denied ? 'access-denied' : 'backend-error', denied ? 401 : 400, startedAt);
      return fail(res, denied ? 401 : 400, message);
    }

    const out = JSON.stringify({ ok: true, data: envelope.data });
    if (Buffer.byteLength(out) > MAX_RESPONSE_BYTES + 200000) {
      logFailure(method, 'response-too-large', 502, startedAt);
      return fail(res, 502, 'The backend answer is too large for the hosted API (limit about 4 MB). Ask the backend to return less data.' + note);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(out);
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;   /* used by the tests */
module.exports.METHODS = METHODS;
