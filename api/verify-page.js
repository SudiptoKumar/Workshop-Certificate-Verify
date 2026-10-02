const fs = require('fs');
const path = require('path');

const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec';
const DEFAULT_BRAND = {
  organizationName: 'Finance Club',
  logoUrl: '',
  verificationUrl: 'https://financeclubpstu.vercel.app/verify'
};

async function loadBranding() {
  const base = String(process.env.WORKSHOP_WEB_APP_URL || DEFAULT_WEB_APP_URL).trim().replace(/\/+$/, '');
  try {
    const response = await fetch(base + '?page=branding-api', {
      redirect: 'follow',
      headers: { 'Accept': 'application/json' }
    });
    const text = await response.text();
    const data = JSON.parse(text);
    if (data && data.ok && data.branding) return { ...DEFAULT_BRAND, ...data.branding };
  } catch (_) {}
  return DEFAULT_BRAND;
}

function safeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

module.exports = async (req, res) => {
  const templatePath = path.join(__dirname, '..', 'public', 'Verify.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  const q = req.query || {};
  let id = String(q.certificateId || q.id || '').trim();
  const pathMatch = String(req.url || '').match(/\/verify\/([^/?#]+)/i);
  if (!id && pathMatch) {
    try { id = decodeURIComponent(pathMatch[1]); } catch (_) { id = pathMatch[1]; }
  }

  const branding = await loadBranding();
  const brandScript = '<script>window.BRAND=' + JSON.stringify(branding) + ';window.AUTO_CERTIFICATE_ID=' + JSON.stringify(id) + ';window.PUBLIC_VERIFY_BASE=' + JSON.stringify(branding.verificationUrl || '') + ';</script>';
  html = html.replace(/<script>window\.BRAND=.*?<\/script>/, brandScript);

  const safeId = safeAttr(id);
  html = html.replace(
    '<input id="certificateId" autocomplete="off" placeholder="e.g. CERT-2026-00001">',
    '<input id="certificateId" autocomplete="off" placeholder="e.g. CERT-2026-00001" value="' + safeId + '">'
  );

  return res.status(200).setHeader('Content-Type','text/html; charset=utf-8').send(html);
};
