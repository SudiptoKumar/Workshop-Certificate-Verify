const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec';

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = (req, res) => {
  const q = req.query || {};
  const id = String(q.certificateId || q.id || '').trim();
  const target = new URL(WEB_APP_URL);
  target.searchParams.set('page', 'verify');
  if (id) target.searchParams.set('certificateId', id);

  const src = escapeAttr(target.toString());
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Certificate Verification</title>
  <style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#f5f7f8}
    iframe{display:block;width:100%;height:100%;border:0}
  </style>
</head>
<body>
  <iframe src="${src}" title="Certificate Verification" allow="clipboard-read; clipboard-write"></iframe>
</body>
</html>`;

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('Cache-Control', 'no-store').send(html);
};
