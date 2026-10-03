const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyli_bIMimi0Xuog_0l0KNkcG6N_KnMylb8MAYvlgkxx0HclAVWx08GHwigjp-C23u4/exec';
const TIMEOUT_MS = 25000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String((req.query && (req.query.certificateId || req.query.id)) || '').trim();
  if (!id) return res.status(400).json({ valid: false, code: 'MISSING_ID', message: 'Certificate ID is required.' });
  if (id.length > 120) return res.status(400).json({ valid: false, code: 'INVALID_ID', message: 'That certificate ID is too long.' });

  const base = String(process.env.WORKSHOP_WEB_APP_URL || DEFAULT_WEB_APP_URL).trim().replace(/\/+$/, '');
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
        message: 'The verification backend did not return valid data. Check that the Apps Script Web App is deployed with access set to "Anyone".'
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
