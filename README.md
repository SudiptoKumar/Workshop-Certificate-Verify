# WORKSHOP V1 — Vercel Original Apps Script Verification Page

This Vercel adapter does NOT contain a copy of Verify.html. It embeds the original Google Apps Script verification page, so the Apps Script Verify.html remains the single source of truth.

## Supported URLs
- `/`
- `/verify`
- `/verify/<CERTIFICATE_ID>`

All three routes proxy/embed the current Apps Script Web App page. Future Verify.html design changes made in Apps Script are reflected automatically.

## Backend
Current Apps Script deployment:
`https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec`
