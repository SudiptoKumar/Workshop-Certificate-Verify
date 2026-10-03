const fs = require('fs');
const path = require('path');

// Read the page template. On Vercel, files under /public are not always bundled into
// the function, so try the bundled copies first and fall back to fetching the static file.
async function loadTemplate(req) {
  const candidates = [
    path.join(process.cwd(), 'public', 'Verify.html'),
    path.join(__dirname, '..', 'public', 'Verify.html')
  ];
  for (const p of candidates) {
    try { return fs.readFileSync(p, 'utf8'); } catch (_) { /* try next */ }
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const r = await fetch(proto + '://' + host + '/Verify.html');
  if (!r.ok) throw new Error('Template not found (' + r.status + ')');
  return r.text();
}

// JSON that is safe to place inside an inline <script> block.
function safeJson(v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

module.exports = async (req, res) => {
  try {
    let html = await loadTemplate(req);
    const q = req.query || {};
    let id = String(q.certificateId || q.id || '').trim();
    const pathMatch = String(req.url || '').match(/\/verify\/([^/?#]+)/i);
    if (!id && pathMatch) {
      try { id = decodeURIComponent(pathMatch[1]); } catch (_) { id = pathMatch[1]; }
    }
    id = id.slice(0, 120);
    // Regex (not an exact-string match) so editing the page's BRAND line cannot break injection.
    // Function replacement avoids "$&"-style patterns in the ID being interpreted.
    html = html.replace(/window\.AUTO_CERTIFICATE_ID\s*=\s*(?:"[^"]*"|'[^']*')\s*;?/, () => 'window.AUTO_CERTIFICATE_ID=' + safeJson(id) + ';');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('Could not load the verification page: ' + (err && err.message ? err.message : err));
  }
};
