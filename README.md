# WORKSHOP V1 — Vercel Redirect to Original Apps Script Verification

This package intentionally contains NO Verify.html and NO verification frontend.

Vercel is only a public redirect layer. The original Google Apps Script deployment remains the single source of truth for the verification page, branding, JavaScript runtime, certificate lookup, and future design changes.

## Routes

- `/` redirects to the original Apps Script verification page.
- `/verify` redirects to the original Apps Script verification page.
- `/verify/CERTIFICATE_ID` redirects to the original Apps Script verification page with `certificateId` in the query string.

## Current Apps Script deployment

https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec

## Important

Do not add a Vercel `Verify.html`. Do not add a second certificate UI. Future verification-page design changes are made only in the Apps Script project.
