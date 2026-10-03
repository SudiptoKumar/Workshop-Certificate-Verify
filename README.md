# Finance Club PSTU — Certificate Verification (Vercel)

Redesigned verification page served by Vercel, backed by the WORKSHOP Automation Apps Script Web App.

## Public URLs

- `https://financeclubpstu.vercel.app/verify`
- `https://financeclubpstu.vercel.app/verify/TEST-CERT-022C0CA90685`
- `https://financeclubpstu.vercel.app/verify?certificateId=TEST-CERT-022C0CA90685`

## How it works

1. `/verify` and `/verify/:id` are rewritten (vercel.json) to `api/verify-page.js`, which serves `public/Verify.html`.
2. The page calls `/api/verify-api?certificateId=...` (`api/verify-api.js`).
3. That function calls the Apps Script endpoint `/exec?page=verify-api&certificateId=...` server-side. The browser never calls Apps Script directly.

## What changed in this version

- `verify-page.js`: injects the certificate ID with a regex, so editing the BRAND line in `Verify.html` no longer breaks it. The ID is escaped to prevent script injection. Falls back to fetching `/Verify.html` if the file is not bundled in the function.
- `vercel.json`: `includeFiles` bundles `public/Verify.html` into the page function; longer `maxDuration` for Apps Script's slow cold starts.
- `verify-api.js`: 25 s timeout, clear messages for timeouts and for non-JSON replies (usually a wrong Apps Script deployment), `Cache-Control: no-store`.
- `Verify.html`: new design; backend failures show an "offline" card instead of "not found".

## Deployment

Copy the folder into the `financeclubpstu.vercel.app` project and redeploy. If you use a different Apps Script deployment, set `WORKSHOP_WEB_APP_URL` in Vercel, otherwise the built-in URL is used.
Apps Script must be deployed as a Web App with **Who has access: Anyone** and **Execute as: Me**, and its `doGet` must handle `page=verify-api`.
Requires Node 18+ (Vercel's default).

## Troubleshooting

Open `/api/verify-api?certificateId=<real id>` directly:
- JSON with `"valid":true` → backend OK.
- `BACKEND_NON_JSON` → Apps Script returned a login/error page: redeploy the Web App ("Anyone" access) and update the URL.
- `BACKEND_ERROR` → network/timeout problem reaching Apps Script.


## Important: Apps Script URL format

Always use the canonical deployed Web App URL:

`https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

Do **not** save or distribute an account-scoped browser URL such as:

`https://script.google.com/macros/u/5/s/DEPLOYMENT_ID/exec`

The `/u/5/` part identifies a signed-in Google account slot in the browser. It is not the stable Web App URL and can produce a Google Drive-style 404 when that account slot does not exist on another device or session. The Vercel API now strips `/u/<number>/` automatically if it is accidentally placed in `WORKSHOP_WEB_APP_URL`.

### When the Apps Script URL changes

**Same Apps Script project:** update the existing Web App deployment to the new saved version. If Google keeps the same `/exec` deployment URL, Vercel does not need a code change.

**New Apps Script project or different Google account:** deploy that project as a Web App, copy the canonical URL ending in `/macros/s/.../exec`, replace `WORKSHOP_WEB_APP_URL` in Vercel (or the built-in URL), then redeploy Vercel.

Before testing Vercel, open the canonical Apps Script URL directly. The base URL should load the verification page. Then test `/exec?page=verify-api&certificateId=...`.
