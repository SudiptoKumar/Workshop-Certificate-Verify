# Finance Club PSTU — Custom Certificate Verification URL Adapter

This small Vercel adapter provides a public URL such as:

`https://financeclubpstu.vercel.app/verify/TEST-CERT-022C0CA90685`

The browser stays on the Vercel URL. Vercel proxies the verification request server-side to the WORKSHOP Automation Apps Script JSON endpoint:

`/exec?page=verify-api&certificateId=...`

## Setup

1. Copy `api/verify-page.js` and `vercel.json` into the Vercel project that serves `financeclubpstu.vercel.app`.
2. Add a Vercel Environment Variable:

`WORKSHOP_WEB_APP_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`

3. Redeploy the Vercel project.
4. Test:

`/verify/TEST-CERT-022C0CA90685`

No browser-side CORS call is required because Vercel talks to Apps Script server-side.

## URL generation in WORKSHOP Automation

Set the Apps Script Control Center → Brand & System Defaults → Public Verification URL to:

`https://financeclubpstu.vercel.app/verify`

The certificate email will then use:

`https://financeclubpstu.vercel.app/verify/<CERTIFICATE_ID>`

You can also use a template value:

`https://financeclubpstu.vercel.app/verify/{CERTIFICATE_ID}`
