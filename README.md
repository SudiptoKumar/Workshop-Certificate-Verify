# Finance Club PSTU — Exact Certificate Verification Page for Vercel

This adapter serves the same `Verify.html` design used by the WORKSHOP Automation Apps Script project. It does not introduce a second verification UI.

## Public URLs

- `https://financeclubpstu.vercel.app/verify`
- `https://financeclubpstu.vercel.app/verify/TEST-CERT-022C0CA90685`
- `https://financeclubpstu.vercel.app/verify?certificateId=TEST-CERT-022C0CA90685`

All three use the same page and the same Apps Script verification backend.

## Backend

The Vercel adapter server-side calls the Apps Script endpoint:
`/exec?page=verify-api&certificateId=...`

The browser never calls Apps Script directly.

## Deployment

Copy the package into the existing `financeclubpstu.vercel.app` project and redeploy. No environment variable is required because the current Apps Script Web App URL is built in. `WORKSHOP_WEB_APP_URL` may optionally override it.
