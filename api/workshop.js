module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const endpoint = process.env.APPS_SCRIPT_WEB_APP_URL;
  if (!endpoint) {
    return res.status(500).json({ ok: false, error: 'APPS_SCRIPT_WEB_APP_URL is not configured in Vercel.' });
  }
  let parsedUrl;
  try { parsedUrl = new URL(endpoint); } catch (_) {
    return res.status(500).json({ ok: false, error: 'APPS_SCRIPT_WEB_APP_URL is invalid.' });
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'script.google.com' || !/\/macros\/s\/[^/]+\/exec$/.test(parsedUrl.pathname) || parsedUrl.search) {
    return res.status(500).json({ ok: false, error: 'APPS_SCRIPT_WEB_APP_URL must be the deployed Google Apps Script /exec URL without query parameters.' });
  }
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch (_) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON request.' });
  }
  if (!body || typeof body !== 'object' || typeof body.method !== 'string' || typeof body.token !== 'string' || !Array.isArray(body.args)) {
    return res.status(400).json({ ok: false, error: 'Request must contain method, token, and args.' });
  }
  if (body.token.length < 48 || body.token.length > 200) {
    return res.status(401).json({ ok: false, error: 'Invalid access token.' });
  }
  try {
    const upstream = await fetch(parsedUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ method: body.method, token: body.token, args: body.args }),
      redirect: 'follow',
      cache: 'no-store'
    });
    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); } catch (_) {
      return res.status(502).json({ ok: false, error: 'Google Apps Script returned a non-JSON response. Check that the new web-app deployment is live.' });
    }
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Could not reach Google Apps Script. Check the deployment URL and try again.' });
  }
}
