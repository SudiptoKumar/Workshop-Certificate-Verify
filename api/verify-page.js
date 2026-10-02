const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  const templatePath = path.join(process.cwd(), 'public', 'Verify.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  const q = req.query || {};
  let id = String(q.certificateId || q.id || '').trim();
  const pathMatch = String(req.url || '').match(/\/verify\/([^/?#]+)/i);
  if (!id && pathMatch) {
    try { id = decodeURIComponent(pathMatch[1]); } catch (_) { id = pathMatch[1]; }
  }
  const safeId = String(id).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  html = html.replace('<script>window.BRAND={organizationName:"Finance Club PSTU",logoUrl:"",verificationUrl:"https://financeclubpstu.vercel.app/verify"};window.AUTO_CERTIFICATE_ID="";</script>',
    '<script>window.BRAND={organizationName:"Finance Club PSTU",logoUrl:"",verificationUrl:"https://financeclubpstu.vercel.app/verify"};window.AUTO_CERTIFICATE_ID='+JSON.stringify(id)+'</script>');
  html = html.replace('<input id="certificateId" autocomplete="off" placeholder="e.g. CERT-2026-00001">', '<input id="certificateId" autocomplete="off" placeholder="e.g. CERT-2026-00001" value="'+safeId+'">');
  return res.status(200).setHeader('Content-Type','text/html; charset=utf-8').send(html);
};
