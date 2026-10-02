# WORKSHOP V1 — Vercel Verification Page

This is the stable Vercel frontend for the WORKSHOP certificate verifier.

## Architecture

Vercel serves a copy of the Apps Script `Verify.html` design and sends verification requests server-side to the current Apps Script Web App. The browser never calls `google.script.run`; Vercel uses the Apps Script JSON verification endpoint instead.

The Apps Script deployment remains the source of truth for certificate data.

## Public URLs

- `https://financeclubpstu.vercel.app/`
- `https://financeclubpstu.vercel.app/verify`
- `https://financeclubpstu.vercel.app/verify/TEST-CERT-022C0CA90685`
- `https://financeclubpstu.vercel.app/verify?certificateId=TEST-CERT-022C0CA90685`

All routes use the same Vercel `Verify.html` page.

## Branding

The page asks the Apps Script Web App for the rendered `window.BRAND` settings and uses those values for the organization name and logo. If that request fails, it safely falls back to Finance Club PSTU without breaking verification.

## Important

Do not deploy the redirect-only package. This package intentionally keeps the Vercel HTML frontend because it must retain the Vercel URL while using the Apps Script verification backend.

## Deployment

Deploy these files to the existing `financeclubpstu.vercel.app` Vercel project. No environment variable is required. `WORKSHOP_WEB_APP_URL` may optionally override the built-in Apps Script URL.
