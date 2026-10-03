# Finance Club PSTU — Certificate Verification (Vercel)

Vercel hosts the public verification page and proxies certificate lookups to the WORKSHOP Automation Apps Script Web App.

## Current backend

This project is currently connected to:

```text
https://script.google.com/macros/s/AKfycbyli_bIMimi0Xuog_0l0KNkcG6N_KnMylb8MAYvlgkxx0HclAVWx08GHwigjp-C23u4/exec
```

The backend URL is intentionally stored in **one file only**:

```text
api/backend-config.js
```

Do not put a second backend URL in `verify-api.js` or in a Vercel environment variable.

## Public URLs

- `https://financeclubpstu.vercel.app/verify`
- `https://financeclubpstu.vercel.app/verify/<CERTIFICATE_ID>`
- `https://financeclubpstu.vercel.app/verify?certificateId=<CERTIFICATE_ID>`

Example:

- `https://financeclubpstu.vercel.app/verify/TEST-CERT-E642808D4472`

## How the system works

```text
Visitor
  ↓
Vercel /verify/<CERTIFICATE_ID>
  ↓
public/Verify.html
  ↓
/api/verify-api
  ↓
api/backend-config.js
  ↓
Google Apps Script /exec?page=verify-api&certificateId=...
  ↓
Certificate sheet
  ↓
JSON response
  ↓
Vercel verification result
```

The browser does **not** call Apps Script directly.

## IMPORTANT: Updating the Apps Script URL

### Case A — Same Apps Script project, new deployment version

If you are only updating the existing WORKSHOP Apps Script project:

1. Save the Apps Script code.
2. Create a new Apps Script version.
3. Edit the existing Web App deployment.
4. Select the new version.
5. Keep the same `/exec` deployment URL.
6. **Do not change this Vercel project.**

The Vercel backend URL stays the same because the deployment URL is unchanged.

### Case B — New Apps Script project

If you create a completely new Apps Script project:

1. Deploy that project as a Web App.
2. Set **Execute as:** `Me`.
3. Set **Who has access:** `Anyone`.
4. Copy the new URL ending in `/exec`.
5. Open:

```text
api/backend-config.js
```

6. Change only this line:

```javascript
const WORKSHOP_WEB_APP_URL = 'PASTE_NEW_APPS_SCRIPT_EXEC_URL_HERE';
```

7. Commit/push the change.
8. Redeploy the Vercel project.
9. Test the Vercel API directly.
10. Test the public certificate URL.

### Case C — New Google account

A different Google account does not change the Vercel architecture.

The new account creates its own Apps Script Web App. After deployment:

```text
New Google account
      ↓
New Apps Script project
      ↓
New /exec URL
      ↓
api/backend-config.js
      ↓
Vercel redeploy
```

Only `api/backend-config.js` needs to change.

### Case D — Different workshop in the SAME Apps Script project

Do **not** create a new Vercel backend URL just because a new workshop is created.

The Apps Script backend is designed to contain multiple workshops/events. The certificate ID is looked up inside the backend's certificate data.

Create the workshop normally in WORKSHOP Automation and keep the same Apps Script `/exec` URL.

## Critical rule about Vercel environment variables

This project does **not** read `WORKSHOP_WEB_APP_URL` from Vercel environment variables.

That is intentional.

A stale Vercel environment variable can silently override the URL you just changed in code and make the verifier contact an old Apps Script project.

Therefore:

- `api/backend-config.js` = single source of truth.
- `verify-api.js` = never contains a second URL.
- Vercel environment variable `WORKSHOP_WEB_APP_URL` = not required.

If an old `WORKSHOP_WEB_APP_URL` variable exists in your Vercel project, remove it or leave it unused. The code will always use `api/backend-config.js`.

## Apps Script requirements

The Apps Script Web App must:

- be deployed as a Web App
- use the `/exec` URL, not `/dev`
- execute as the owner (`Me`)
- allow access to `Anyone`
- contain a `doGet(e)` route for `page=verify-api`
- return JSON for the verification API request

The Vercel proxy calls:

```text
<YOUR_EXEC_URL>/exec?page=verify-api&certificateId=<ID>
```

Actually, because the configured value already includes `/exec`, the final request is:

```text
<YOUR_EXEC_URL>?page=verify-api&certificateId=<ID>
```

## Testing after every URL change

### 1. Test Apps Script directly

Open:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?page=verify-api&certificateId=YOUR_CERTIFICATE_ID
```

Expected result: JSON, for example:

```json
{
  "valid": true,
  "code": "VALID"
}
```

If this direct URL does not return JSON, fix Apps Script first. Vercel cannot repair a broken backend deployment.

### 2. Test the Vercel API

Open:

```text
https://financeclubpstu.vercel.app/api/verify-api?certificateId=YOUR_CERTIFICATE_ID
```

Expected:

```json
{
  "valid": true
}
```

### 3. Test the public page

Open:

```text
https://financeclubpstu.vercel.app/verify/YOUR_CERTIFICATE_ID
```

The certificate details should appear.

## Troubleshooting

### `BACKEND_NON_JSON`

Apps Script returned HTML instead of JSON. Usually check:

- wrong `/exec` URL
- `/dev` URL used instead of `/exec`
- Web App is not deployed
- access is not `Anyone`
- Apps Script `doGet` does not support `page=verify-api`
- deployment was not updated after code changes

### `BACKEND_ERROR`

Vercel could not successfully reach the Apps Script endpoint or the request timed out.

First test the Apps Script URL directly.

### `Certificate not found`

The backend responded successfully, but that certificate ID is not present in the selected Apps Script project's certificate data.

This is different from a broken Vercel connection.

### Vercel page works but data is empty/not found

Check in this order:

```text
1. api/backend-config.js contains the correct /exec URL
2. Vercel has been redeployed after the change
3. Apps Script direct API URL returns JSON
4. Vercel /api/verify-api returns JSON
5. Public /verify/<ID> page returns the certificate
```

## Files

```text
Workshop-Certificate-Verify-main/
├── README.md
├── api/
│   ├── backend-config.js   ← change this when backend URL changes
│   ├── verify-api.js
│   └── verify-page.js
├── public/
│   └── Verify.html
└── vercel.json
```

## Deployment

Deploy the project to the existing Vercel project that serves `financeclubpstu.vercel.app`.

Node 18+ is required.
