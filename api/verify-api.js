const { WORKSHOP_WEB_APP_URL } = require('./backend-config');
const TIMEOUT_MS = 25000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String((req.query && (req.query.certificateId || req.query.id)) || '').trim();
  if (!id) return res.status(400).json({ valid: false, code: 'MISSING_ID', message: 'Certificate ID is required.' });
  if (id.length > 120) return res.status(400).json({ valid: false, code: 'INVALID_ID', message: 'That certificate ID is too long.' });

  const base = String(WORKSHOP_WEB_APP_URL || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(base)) {
    return res.status(500).json({ valid: false, code: 'BACKEND_URL_INVALID', message: 'The Apps Script Web App URL is invalid. Check api/backend-config.js.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = base + '?page=verify-api&certificateId=' + encodeURIComponent(id);
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'Accept': 'application/json' } });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) {
      return res.status(502).json({
        valid: false,
        code: 'BACKEND_NON_JSON',
        message: 'The Apps Script verification backend did not return JSON. Check the Web App deployment, access setting, and backend URL.'
      });
    }
    return res.status(data && data.valid ? 200 : 404).json(data);
  } catch (err) {
    const message = err && err.name === 'AbortError'
      ? 'The verification service took too long to respond. Please try again.'
      : String(err && err.message ? err.message : err);
    return res.status(502).json({ valid: false, code: 'BACKEND_ERROR', message });
  } finally {
    clearTimeout(timer);
  }
};
