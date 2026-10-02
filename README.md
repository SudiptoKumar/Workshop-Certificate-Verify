# WORKSHOP V1 — Global Branding Verification

This package keeps the **exact same Certificate Verification design** as the working Apps Script page while making Vercel read branding from the Apps Script backend.

## Architecture

Vercel `/verify/...` → Vercel server function → Apps Script `?page=branding-api` and `?page=verify-api` → master Google Sheet.

Brand settings come from the Apps Script Control Center (`DEFAULT_LOGO_URL`, `ORGANIZATION_NAME`, `PUBLIC_VERIFY_URL`). You only maintain the logo URL once.

## Apps Script update required

Deploy the updated `apps_script/WORKSHOP_Automation.gs` from this package to the same Apps Script project, then create a new web-app deployment/version if your project uses versioned deployments.

The new backend endpoint is:
`https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec?page=branding-api`

It returns the public branding settings used by Vercel.

## Vercel deploy

Deploy the contents of the `vercel/` folder to the existing `financeclubpstu.vercel.app` project. No Vercel environment variable is required; `WORKSHOP_WEB_APP_URL` remains an optional override.

## Test

- `https://financeclubpstu.vercel.app/verify`
- `https://financeclubpstu.vercel.app/verify/TEST-CERT-022C0CA90685`
- `https://financeclubpstu.vercel.app/api/branding`

The Vercel page will show the same logo and organization name configured in Apps Script.
