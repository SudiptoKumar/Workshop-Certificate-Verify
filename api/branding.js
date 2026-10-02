const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec';

module.exports = async (req, res) => {
  const base = String(process.env.WORKSHOP_WEB_APP_URL || DEFAULT_WEB_APP_URL).trim().replace(/\/+$/, '');
  try {
    const response = await fetch(base + '?page=branding-api', {redirect:'follow', headers:{'Accept':'application/json'}});
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) {
      return res.status(502).json({ok:false,code:'BACKEND_NON_JSON',message:'Apps Script returned a non-JSON response.'});
    }
    return res.status(data && data.ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(502).json({ok:false,code:'BACKEND_ERROR',message:String(err && err.message ? err.message : err)});
  }
};
