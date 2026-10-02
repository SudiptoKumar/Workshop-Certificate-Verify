const fs = require('fs');
const path = require('path');

const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec';
const FALLBACK_BRAND = {
  organizationName: 'Finance Club PSTU',
  logoUrl: '',
  verificationUrl: 'https://financeclubpstu.vercel.app/verify'
};

function escAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function extractBrand(html) {
  const match = html.match(/window\.BRAND\s*=\s*(\{.*?\})\s*;/s);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return {
      organizationName: String(parsed.organizationName || FALLBACK_BRAND.organizationName),
      logoUrl: String(parsed.logoUrl || ''),
      verificationUrl: String(parsed.verificationUrl || FALLBACK_BRAND.verificationUrl)
    };
  } catch (_) {
    return null;
  }
}

async function getBrand() {
  const base = String(process.env.WORKSHOP_WEB_APP_URL || DEFAULT_WEB_APP_URL).trim().replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(base, {
      redirect: 'follow',
      headers: { 'Accept': 'text/html' },
      signal: controller.signal
    });
    if (!response.ok) return FALLBACK_BRAND;
    const html = await response.text();
    return extractBrand(html) || FALLBACK_BRAND;
  } catch (_) {
    return FALLBACK_BRAND;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  const templatePath = path.join(__dirname, '..', 'public', 'Verify.html');
  let html;
  try {
    html = fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    return res.status(500).send('Verification page could not be loaded.');
  }

  const q = req.query || {};
  let id = String(q.certificateId || q.id || '').trim();
  const pathMatch = String(req.url || '').match(/\/verify\/([^/?#]+)/i);
  if (!id && pathMatch) {
    try { id = decodeURIComponent(pathMatch[1]); } catch (_) { id = pathMatch[1]; }
  }

  const brand = await getBrand();
  const brandScript = '<script>window.BRAND=' + JSON.stringify(brand) + ';window.AUTO_CERTIFICATE_ID=' + JSON.stringify(id) + ';</script>';
  html = html.replace(/<script>window\.BRAND=.*?<\/script>/s, brandScript);

  if (id) {
    const safeId = escAttr(id);
    html = html.replace(
      '<input id="certificateId" autocomplete="off" placeholder="e.g. CERT-2026-00001">',
      '<input id="certificateId" autocomplete="off" placeholder="e.g. CERT-2026-00001" value="' + safeId + '">'
    );
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.send(html);
};
