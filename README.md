# WORKSHOP V1 — Vercel → Original Apps Script Verify Page

This version intentionally does **not** copy or recreate `Verify.html` on Vercel.

Vercel only provides the public URL and embeds the original Google Apps Script verification page.

## Architecture

`financeclubpstu.vercel.app/verify/...`
→ Vercel wrapper
→ original Apps Script Web App `/exec?page=verify...`
→ original Apps Script `Verify.html`
→ original `google.script.run.verifyCertificatePublic()` logic

## Why this version

There is now only **one** verification page source: the `Verify.html` inside Google Apps Script.

When you change the verification design in Apps Script later (logo, layout, colors, text, animation, mobile design, result card, etc.), Vercel automatically shows that same updated page. No second `Verify.html` needs to be edited.

## Current Apps Script backend

`https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec`

## Vercel routes

- `/verify`
- `/verify/TEST-CERT-022C0CA90685`
- `/verify?certificateId=TEST-CERT-022C0CA90685`

## Important

The Vercel page is a transparent full-screen wrapper around the original Apps Script page. The Vercel address remains visible in the browser, while the actual verification UI and verification JavaScript remain owned by Apps Script.

No Apps Script code change is required for this architecture.

## Deploy

Deploy the contents of this package to the existing `financeclubpstu.vercel.app` project.
