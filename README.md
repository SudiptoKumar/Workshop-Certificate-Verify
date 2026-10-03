# Finance Club PSTU — Certificate Verification

This is the production Vercel verification frontend for WORKSHOP Automation.

## Current Apps Script backend

```text
https://script.google.com/macros/s/AKfycbyli_bIMimi0Xuog_0l0KNkcG6N_KnMylb8MAYvlgkxx0HclAVWx08GHwigjp-C23u4/exec
```

The Vercel project uses `api/backend-config.js` as the **single source of truth** for this URL.

## Architecture

```text
Visitor
  ↓
https://financeclubpstu.vercel.app/verify/<CERTIFICATE_ID>
  ↓
Vercel /api/verify-api
  ↓
Apps Script /exec?page=verify-api&certificateId=...
  ↓
WORKSHOP Certificates sheet
  ↓
JSON result
  ↓
Vercel verification card
```

The browser does not need to call Apps Script directly.

## Important Apps Script requirement

The Apps Script `doGet(e)` must explicitly support:

```text
?page=verify-api&certificateId=...
```

That route must return JSON. A normal verification-page request must return `Verify.html`.

This release (`V1.3.5`) contains that route.

## The URL rule

Always use:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Never configure Vercel with:

```text
https://script.google.com/macros/u/5/s/DEPLOYMENT_ID/exec
```

The `/u/5/` part is an account-scoped browser URL. `api/verify-api.js` also strips an accidental `/u/<number>/` segment as a safety net.

## Updating the Apps Script code in the same project

When the Apps Script project remains the same:

1. Replace the Apps Script code with the latest backend files.
2. Save the project.
3. Go to **Deploy → Manage deployments**.
4. Edit the existing Web App deployment.
5. Select **New version**.
6. Deploy.
7. Keep the same Web App deployment URL if Google keeps the deployment ID.
8. Do **not** change `api/backend-config.js` just because the code version changed.

## Moving to a completely new Apps Script project or Google account

When the backend is moved to another Google account/project:

1. Deploy the new Apps Script project as a Web App.
2. Copy the canonical URL ending in `/macros/s/.../exec`.
3. Edit only:

```text
api/backend-config.js
```

4. Replace `WORKSHOP_WEB_APP_URL` with the new canonical URL.
5. Redeploy Vercel.
6. Test the Apps Script API directly.
7. Test the Vercel API.
8. Test the public verification page.

No other Vercel source file should need to change.

## Test order

### 1. Apps Script health

```text
<APPS_SCRIPT_EXEC_URL>?page=health
```

Expected shape:

```json
{"ok":true,"version":"V1.3.5","service":"certificate-verification"}
```

### 2. Apps Script certificate API

```text
<APPS_SCRIPT_EXEC_URL>?page=verify-api&certificateId=TEST-CERT-E642808D4472
```

A valid test certificate should return:

```json
{
  "valid": true,
  "code": "VALID",
  "certificateId": "TEST-CERT-E642808D4472",
  "isTest": true
}
```

### 3. Vercel API

```text
https://financeclubpstu.vercel.app/api/verify-api?certificateId=TEST-CERT-E642808D4472
```

### 4. Public page

```text
https://financeclubpstu.vercel.app/verify/TEST-CERT-E642808D4472
```

## Troubleshooting

### `BACKEND_NON_JSON`
The Apps Script endpoint returned HTML instead of JSON. Usually the Web App is running an older deployment that does not contain the `page=verify-api` route, or the URL is wrong.

### `BACKEND_ERROR`
The Vercel function could not reach Apps Script or timed out.

### `NOT_FOUND`
The backend is responding correctly, but the certificate ID does not match the current backend data.

### The Apps Script base URL shows an old WORKSHOP version
The existing versioned deployment is still pointing at an older Apps Script version. Edit the deployment and select **New version**.

## Vercel deployment

Deploy the entire `Vercel-Certificate-Verify` folder as the Vercel project root.

No `WORKSHOP_WEB_APP_URL` environment variable is required in this release. Keeping the backend URL in `api/backend-config.js` avoids hidden environment-variable overrides.

## Public URL

```text
https://financeclubpstu.vercel.app/verify
```
