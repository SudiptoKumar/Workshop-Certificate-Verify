// SINGLE SOURCE OF TRUTH for the Apps Script production Web App URL.
// Update only this value when the backend moves to a different Apps Script
// project or Google account, then redeploy Vercel.
const WORKSHOP_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyli_bIMimi0Xuog_0l0KNkcG6N_KnMylb8MAYvlgkxx0HclAVWx08GHwigjp-C23u4/exec';

function normalizeWebAppUrl(value) {
  let url = String(value || '').trim();
  // Accept an accidentally copied account-scoped URL such as /macros/u/5/s/...
  // and normalize it to the canonical /macros/s/.../exec form.
  url = url.replace(/\/macros\/u\/\d+\/s\//, '/macros/s/');
  url = url.replace(/[?#].*$/, '');
  return url.replace(/\/+$/, '');
}

module.exports = {
  WORKSHOP_WEB_APP_URL,
  normalizeWebAppUrl
};
