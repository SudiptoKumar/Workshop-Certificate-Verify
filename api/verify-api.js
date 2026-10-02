const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec';

module.exports = async (req, res) => {
  const id = String((req.query && (req.query.certificateId || req.query.id)) || '').trim();
  if (!id) return res.status(400).json({valid:false, code:'MISSING_ID', message:'Certificate ID is required.'});
  const base = String(process.env.WORKSHOP_WEB_APP_URL || DEFAULT_WEB_APP_URL).trim().replace(/\/+$/, '');
  try {
    const url = base + '?page=verify-api&certificateId=' + encodeURIComponent(id);
    const response = await fetch(url, {redirect:'follow', headers:{'Accept':'application/json'}});
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { return res.status(502).json({valid:false,code:'BACKEND_NON_JSON',message:'Apps Script returned a non-JSON response.'}); }
    return res.status(data && data.valid ? 200 : 404).json(data);
  } catch (err) {
    return res.status(502).json({valid:false,code:'BACKEND_ERROR',message:String(err && err.message ? err.message : err)});
  }
};
