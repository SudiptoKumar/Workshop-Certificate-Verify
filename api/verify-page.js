const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage(data, certificateId) {
  const valid = !!(data && data.valid);
  const isTest = !!(data && data.isTest);
  const title = valid ? (isTest ? 'Test Certificate Valid' : 'Certificate Valid') : 'Certificate Verification';
  const body = valid
    ? `<div class="status ok">✓ ${isTest ? 'Test certificate valid' : 'Certificate valid'}</div>
       <div class="grid">
         <div><span>Certificate ID</span><strong>${esc(data.certificateId)}</strong></div>
         <div><span>Name</span><strong>${esc(data.name)}</strong></div>
         <div><span>Workshop</span><strong>${esc(data.workshopName)}</strong></div>
         <div><span>Event ID</span><strong>${esc(data.eventId)}</strong></div>
         <div><span>Issue Date</span><strong>${esc(data.issueDate)}</strong></div>
       </div>`
    : `<div class="status bad">Certificate not found</div><p class="message">${esc(data && data.message ? data.message : 'No matching certificate was found.')}</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Finance Club PSTU</title>
<style>
:root{--ink:#10211e;--muted:#697670;--line:#d8e2df;--bg:#f4f7f6;--card:#fff;--accent:#0e7c66;--ok:#047857;--bad:#b91c1c}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#f7faf9,#eef4f2);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{width:min(760px,100%);background:var(--card);border:1px solid var(--line);border-radius:28px;overflow:hidden;box-shadow:0 24px 80px rgba(16,33,30,.10)}
.hero{padding:32px;background:linear-gradient(135deg,#10211e,#164e44);color:#fff}.brand{font-weight:800;font-size:16px}.eyebrow{margin-top:32px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.7}h1{margin:8px 0;font-size:34px;line-height:1.08}.sub{margin:0;color:rgba(255,255,255,.78)}
.body{padding:30px 32px}.form{display:flex;gap:10px}input{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:13px;padding:14px 15px;font-size:15px}button{border:0;border-radius:13px;padding:0 22px;background:var(--accent);color:#fff;font-weight:800;cursor:pointer;height:48px}.result{margin-top:22px;padding:20px;border:1px solid var(--line);border-radius:18px}.status{font-size:19px;font-weight:850;margin-bottom:16px}.status.ok{color:var(--ok)}.status.bad{color:var(--bad)}.message{margin:0;color:var(--muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid div{padding:14px;border:1px solid #e4ebe8;border-radius:14px}.grid span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.grid strong{display:block;overflow-wrap:anywhere}.foot{padding:18px 32px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
@media(max-width:620px){.wrap{padding:12px}.hero,.body,.foot{padding:24px 20px}.form{flex-direction:column}.grid{grid-template-columns:1fr}}
</style></head>
<body><div class="wrap"><main class="card"><section class="hero"><div class="brand">Finance Club PSTU</div><div class="eyebrow">Official verification</div><h1>Certificate Verification</h1><p class="sub">Verify a workshop certificate using its certificate ID.</p></section>
<section class="body"><form class="form" method="get" action="/verify"><input name="certificateId" value="${esc(certificateId)}" placeholder="CERT-... or TEST-CERT-..." autocomplete="off"><button type="submit">Verify</button></form>
<div class="result">${body}</div></section><footer class="foot">Official certificate verification page · Finance Club PSTU</footer></main></div></body></html>`;
}

module.exports = async (req, res) => {
  try {
    const certificateId = String((req.query && req.query.certificateId) || '').trim();
    const base = String(process.env.WORKSHOP_WEB_APP_URL || DEFAULT_WEB_APP_URL).trim();
    if (!/^https:\/\//i.test(base)) {
      return res.status(500).send('Verification backend URL is invalid.');
    }
    if (!certificateId) return res.status(400).send(renderPage({valid:false,message:'Certificate ID is required.'}, ''));

    const url = base.replace(/\/+$/, '') + '?page=verify-api&certificateId=' + encodeURIComponent(certificateId);
    const response = await fetch(url, {redirect:'follow'});
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { throw new Error('Apps Script returned a non-JSON response.'); }

    return res.status(data && data.valid ? 200 : 404).setHeader('Content-Type','text/html; charset=utf-8').send(renderPage(data, certificateId));
  } catch (err) {
    return res.status(502).setHeader('Content-Type','text/html; charset=utf-8').send(renderPage({valid:false,message:'Verification service is temporarily unavailable. '+String(err && err.message ? err.message : err)}, ''));
  }
};
