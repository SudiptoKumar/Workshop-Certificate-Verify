# Workshop Certificate Verification — Vercel Proxy

This project provides a clean public verification URL for the Workshop Automation V1 certificate system.

## Architecture

Visitor:
`/verify/CERTIFICATE_ID`

→ Vercel rewrite

→ Google Apps Script Web App

→ `Verify.html` / certificate database

## Backend

Google Apps Script Web App:

`https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec`

## Example

After deployment, use:

`https://YOUR-VERCEL-DOMAIN/verify/TEST-CERT-022C0CA90685`

The Vercel project does not contain the Workshop backend or certificate data. It only proxies the public verification route to the existing Apps Script Web App.

## GitHub → Vercel

1. Upload the contents of this ZIP to a new GitHub repository.
2. In Vercel, choose **Add New → Project**.
3. Import the GitHub repository.
4. Keep the default settings.
5. Deploy.
6. Test `/verify/TEST-CERT-022C0CA90685`.

## Important

Keep the existing Apps Script Web App deployment active. This project depends on its `/exec` URL.

The Apps Script URL is already configured in `vercel.json`.
